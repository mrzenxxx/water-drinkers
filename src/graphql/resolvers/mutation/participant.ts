import type { User as PrismaUser } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin } from '@/graphql/context';
import { badInput, conflict, notFound, requireText } from '@/graphql/errors';
import type { MutationResolvers, ParticipantProfileInput } from '@/graphql/generated/graphql';
import { Restriction } from '@/graphql/generated/graphql';
import {
  LOGIN_MAX_LENGTH,
  LOGIN_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  credentialFields,
  isAcceptablePassword,
  isValidLogin,
  issueSession,
  normalizeLogin,
} from '@/lib/auth';
import type { DbClient } from '@/lib/data';
import { writeAudit } from '@/lib/data';

/**
 * Учётные записи участников: данные человека, логин с паролем и ограничения
 * (§3, §6.7, ADR-0004).
 *
 * Логин и пароль приходят от администратора: сервер их только предлагает
 * (`Query.suggestCredentials`), а администратор может поправить перед
 * сохранением. Поэтому здесь они проверяются заново, как любой ввод.
 */

/** ФИО, почта и отдел — после проверки и приведения к хранимому виду. */
export type ParticipantProfile = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  departmentId: string | null;
  newDepartment: string | null;
};

function optionalText(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
}

export function readProfile(input: ParticipantProfileInput): ParticipantProfile {
  const email = optionalText(input.email)?.toLowerCase() ?? null;
  if (email !== null && !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw badInput('Почта указана неверно.', { field: 'email' });
  }

  return {
    firstName: requireText(input.firstName, 'firstName'),
    middleName: optionalText(input.middleName),
    lastName: requireText(input.lastName, 'lastName'),
    email,
    departmentId: optionalText(input.departmentId),
    newDepartment: optionalText(input.newDepartment),
  };
}

/** Почта необязательна, но если указана — одна на человека. */
export async function requireFreeEmail(db: DbClient, email: string | null, exceptId?: string): Promise<void> {
  if (email === null) return;
  const owner = await db.user.findUnique({ where: { email } });
  if (owner !== null && owner.id !== exceptId) {
    throw conflict('Эта почта уже указана у другого участника.', { field: 'email' });
  }
}

/**
 * Отдел участника: выбранный из справочника или новый по названию. Новый
 * с именем уже существующего не дублируется — берётся тот, что есть.
 */
export async function resolveDepartment(tx: DbClient, profile: ParticipantProfile): Promise<string | null> {
  if (profile.newDepartment !== null) {
    const existing = await tx.department.findUnique({ where: { name: profile.newDepartment } });
    if (existing !== null) return existing.id;
    const created = await tx.department.create({ data: { name: profile.newDepartment } });
    return created.id;
  }

  if (profile.departmentId !== null) {
    const found = await tx.department.findUnique({ where: { id: profile.departmentId } });
    if (found === null) throw badInput('Отдел не найден.', { field: 'departmentId' });
    return found.id;
  }

  return null;
}

/** Логин и пароль, введённые или поправленные администратором. */
export async function requireCredentials(
  db: DbClient,
  rawLogin: string,
  password: string,
  exceptId?: string,
): Promise<string> {
  const login = normalizeLogin(rawLogin);
  if (!isValidLogin(login)) {
    throw badInput(
      `Логин — от ${LOGIN_MIN_LENGTH} до ${LOGIN_MAX_LENGTH} символов: латиница, цифры, точка и дефис.`,
      { field: 'login' },
    );
  }
  if (!isAcceptablePassword(password)) {
    throw badInput(`Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов.`, { field: 'password' });
  }

  const owner = await db.user.findUnique({ where: { login } });
  if (owner !== null && owner.id !== exceptId) {
    throw conflict('Такой логин уже занят.', { field: 'login' });
  }

  return login;
}

async function loadParticipant(db: DbClient, id: string): Promise<PrismaUser> {
  const row = await db.user.findUnique({ where: { id } });
  if (row === null) throw notFound('Участник не найден.', { id });
  return row;
}

/** Снимок данных человека для журнала: без пароля и ссылки. */
function profileSnapshot(user: PrismaUser) {
  return {
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    email: user.email,
    departmentId: user.departmentId,
  };
}

export const participantMutations: Pick<
  MutationResolvers<GraphQLContext>,
  'updateParticipant' | 'issueCredentials' | 'setParticipantRestriction'
> = {
  /**
   * Правка ФИО, почты и отдела. Логин при этом не меняется: человек уже
   * получил его и входит с ним. Сменить логин — это `issueCredentials`.
   */
  updateParticipant: async (_parent, { id, input }, ctx) => {
    const admin = await requireAdmin(ctx);
    const profile = readProfile(input);
    const user = await loadParticipant(ctx.db, id);
    await requireFreeEmail(ctx.db, profile.email, id);

    const updated = await ctx.db.$transaction(async (tx) => {
      const departmentId = await resolveDepartment(tx, profile);
      const row = await tx.user.update({
        where: { id },
        data: {
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          email: profile.email,
          departmentId,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.update',
        entity: 'user',
        entityId: id,
        before: profileSnapshot(user),
        after: profileSnapshot(row),
      });

      return row;
    });

    ctx.loaders.userById.clear(id).prime(id, updated);
    return updated;
  },

  /**
   * Новые логин, пароль и магическая ссылка. Все прежние входы участника
   * отзываются: если данные перевыпускают, старые, скорее всего, утекли
   * или потерялись.
   */
  issueCredentials: async (_parent, { id, login: rawLogin, password }, ctx) => {
    const admin = await requireAdmin(ctx);
    const user = await loadParticipant(ctx.db, id);
    const login = await requireCredentials(ctx.db, rawLogin, password, id);

    const now = new Date();
    const { data, credentials } = await credentialFields(ctx.config, login, password, now);

    const updated = await ctx.db.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.credentials',
        entity: 'user',
        entityId: id,
        before: { login: user.login },
        after: { login },
      });

      return row;
    });

    // Перевыпуск себе самому отозвал бы и текущую сессию администратора —
    // выдаём взамен новую, того же момента, что и отзыв.
    if (id === admin.id) {
      await ctx.setSessionCookie(issueSession(id, ctx.config.sessionSecret, now));
    }

    ctx.loaders.userById.clear(id).prime(id, updated);
    return {
      user: updated,
      credentials: { ...credentials, magicLinkExpiresAt: credentials.magicLinkExpiresAt.toISOString() },
    };
  },

  /**
   * Мьют и бан (§3). Администратора не ограничить: он снимет ограничение
   * сам с себя, а заодно так нельзя случайно запереть панель.
   */
  setParticipantRestriction: async (_parent, { id, restriction }, ctx) => {
    const admin = await requireAdmin(ctx);
    const user = await loadParticipant(ctx.db, id);

    if (user.restriction === restriction) return user;
    if (user.role === 'ADMIN' && restriction !== Restriction.None) {
      throw conflict('Администратора ограничить нельзя. Сначала снимите с него роль.', { id });
    }

    const updated = await ctx.db.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: {
          restriction,
          // Бан выкидывает и из уже открытых сессий, а не только закрывает вход.
          ...(restriction === Restriction.Banned ? { sessionsValidAfter: new Date() } : {}),
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.restriction',
        entity: 'user',
        entityId: id,
        before: { restriction: user.restriction },
        after: { restriction },
      });

      return row;
    });

    ctx.loaders.userById.clear(id).prime(id, updated);
    return updated;
  },
};
