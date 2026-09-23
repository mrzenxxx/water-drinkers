import type { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin } from '@/graphql/context';
import {
  badInput,
  conflict,
  graphqlError,
  isExclusionViolation,
  notFound,
  requireDate,
  requireMoney,
  requireNegativeMoney,
  requireNonZeroMoney,
  requirePositiveMoney,
  requireText,
} from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { credentialFields } from '@/lib/auth';
import { checkOpeningInvariant, compareDates, isMemberOn, splitOpeningBalanceEqually } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import { fromIsoDate, toBigIntKopecks, toIsoDate, toKopecks, writeAudit } from '@/lib/data';
import type { DbClient } from '@/lib/data';

import { readProfile, requireCredentials, requireFreeEmail, resolveDepartment } from './participant';

/**
 * Администрирование состава и денег — админ-панель §6.7.
 *
 * Три правила, которым подчинены все мутации этого файла:
 *
 *  1. **Журнал операций неизменяем** (правило 4). Ни одна из них не правит и не
 *     удаляет строку `fund_transactions`; ошибка гасится встречной записью
 *     `ADJUSTMENT` (§2.4).
 *  2. **Инвариант §5 держится после каждой операции.** Любая запись, меняющая
 *     остаток фонда, той же транзакцией меняет чей-то личный баланс — иначе
 *     половина равенства уезжает, а вторая остаётся.
 *  3. **Запись в `audit_log` идёт внутри той же транзакции**, что и изменение:
 *     запись «мимо» транзакции переживёт откат и станет свидетельством
 *     о действии, которого не было.
 *
 * Физического удаления участника здесь нет и не будет (§6.7): за человеком
 * числятся взносы и доли в заказах, и его исчезновение ломает и инвариант,
 * и историю, которую приложение обещает показывать.
 */

/** Участник по id или внятная ошибка вместо `null` где-то ниже по стеку. */
async function loadParticipant(db: DbClient, id: string): Promise<PrismaUser> {
  const row = await db.user.findUnique({ where: { id } });
  if (row === null) {
    throw notFound('Участник не найден.', { id });
  }
  return row;
}

/**
 * Сколько администраторов останется в составе, если не считать `exceptId`.
 *
 * Считаются только действующие: администратор, вышедший из состава, панель уже
 * не откроет (§6.7 — доступ по роли, но человек ушёл), и полагаться на него как
 * на «последнего оставшегося» нельзя.
 */
async function otherActiveAdmins(db: DbClient, exceptId: string): Promise<number> {
  return db.user.count({ where: { role: 'ADMIN', leftAt: null, id: { not: exceptId } } });
}

const LAST_ADMIN = 'В составе должен остаться хотя бы один действующий администратор.';

/** Начальное сальдо фонда после сдвига на `delta`. Пишется вместе с сальдо участника. */
async function shiftFundOpeningBalance(tx: DbClient, delta: number): Promise<void> {
  if (delta === 0) return;

  const settings = await tx.fundSettings.findUnique({ where: { id: 1 } });
  const current = settings === null ? 0 : toKopecks(settings.openingBalance, 'начальное сальдо фонда');

  await tx.fundSettings.upsert({
    where: { id: 1 },
    create: { id: 1, openingBalance: toBigIntKopecks(current + delta, 'начальное сальдо фонда') },
    update: { openingBalance: toBigIntKopecks(current + delta, 'начальное сальдо фонда') },
  });
}

/** Пересечение отсутствий (§11) — то же сообщение, что и при вводе за себя. */
function overlapError(startsOn: IsoDate, endsOn: IsoDate): ReturnType<typeof graphqlError> {
  return graphqlError(
    `Отсутствие с ${startsOn} по ${endsOn} пересекается с уже отмеченным у этого участника. ` +
      'Нельзя быть одновременно в отпуске и на больничном.',
    'ABSENCE_OVERLAP',
    { startsOn, endsOn },
  );
}

export const adminMutations: Pick<
  MutationResolvers<GraphQLContext>,
  | 'setOpeningBalances'
  | 'addParticipant'
  | 'deactivateParticipant'
  | 'reactivateParticipant'
  | 'setParticipantRole'
  | 'settleParticipant'
  | 'createAdjustment'
  | 'addContributionFor'
  | 'addAbsenceFor'
> = {
  /**
   * Стартовое состояние учёта (§4.2).
   *
   * Не сохраняется, пока `Σ openingBalance(i) == fundOpeningBalance`: это тот же
   * инвариант §5, применённый к начальной точке. Расхождение возвращается
   * клиенту величиной в `extensions.difference` — форме есть что показать.
   *
   * Настройки фонда и сальдо участников пишутся **одной транзакцией**. Разъехавшись,
   * они дали бы приложение, которое стартует уже с нарушенным инвариантом.
   */
  setOpeningBalances: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const startDate = requireDate(input.startDate, 'startDate');
    const fundOpeningBalance = requireMoney(input.fundOpeningBalance, 'fundOpeningBalance');

    const users = await ctx.db.user.findMany({ orderBy: { id: 'asc' } });
    if (users.length === 0 && fundOpeningBalance !== 0) {
      throw badInput('Нельзя задать ненулевое начальное сальдо фонда без участников.', {
        field: 'fundOpeningBalance',
      });
    }

    const equalSplit = input.equalSplit === true;
    let amounts: Map<string, number>;

    if (equalSplit) {
      // Раздаём тем, кто состоит в фонде на дату начала учёта: сальдо человека,
      // ушедшего до неё, не значит ничего. Если таких нет — всем известным,
      // иначе деньги фонда оказались бы ничьими и инвариант поехал бы.
      const members = users.filter((user) =>
        isMemberOn(
          { id: user.id, joinedAt: toIsoDate(user.joinedAt), leftAt: user.leftAt === null ? null : toIsoDate(user.leftAt), openingBalance: 0 },
          startDate,
        ),
      );
      const recipients = (members.length > 0 ? members : users).map((user) => user.id);
      amounts = fundOpeningBalance === 0
        ? new Map(users.map((user) => [user.id, 0]))
        : splitOpeningBalanceEqually(fundOpeningBalance, recipients);
    } else {
      amounts = new Map();
      for (const entry of input.openingBalances) {
        if (amounts.has(entry.userId)) {
          throw badInput('Участник указан в начальных сальдо дважды.', { userId: entry.userId });
        }
        amounts.set(entry.userId, requireMoney(entry.amount, 'openingBalance'));
      }

      const known = new Set(users.map((user) => user.id));
      for (const userId of amounts.keys()) {
        if (!known.has(userId)) {
          throw notFound('Участник из списка начальных сальдо не найден.', { userId });
        }
      }
    }

    // Не перечисленный участник получает ноль: сумма §4.2 берётся по **всем**
    // участникам, и молча оставленное старое значение сломало бы равенство.
    const participants = users.map((user) => ({
      id: user.id,
      joinedAt: toIsoDate(user.joinedAt),
      leftAt: user.leftAt === null ? null : toIsoDate(user.leftAt),
      openingBalance: amounts.get(user.id) ?? 0,
    }));

    const report = checkOpeningInvariant(participants, fundOpeningBalance);
    if (!report.isConsistent) {
      throw badInput(
        'Сумма начальных сальдо участников не совпадает с начальным сальдо фонда (§4.2).',
        {
          field: 'openingBalances',
          fundOpeningBalance,
          balancesSum: report.balancesSum,
          difference: report.difference,
        },
      );
    }

    await ctx.db.$transaction(async (tx) => {
      const before = await tx.fundSettings.findUnique({ where: { id: 1 } });

      await tx.fundSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          openingBalance: toBigIntKopecks(fundOpeningBalance, 'начальное сальдо фонда'),
          startDate: fromIsoDate(startDate),
        },
        update: {
          openingBalance: toBigIntKopecks(fundOpeningBalance, 'начальное сальдо фонда'),
          startDate: fromIsoDate(startDate),
        },
      });

      // `updateMany` тут не годится: у каждого своя сумма.
      for (const participant of participants) {
        await tx.user.update({
          where: { id: participant.id },
          data: {
            openingBalance: toBigIntKopecks(
              participant.openingBalance,
              `начальное сальдо ${participant.id}`,
            ),
          },
        });
      }

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'fund.opening',
        entity: 'fund_settings',
        // Ключ таблицы — SMALLINT, а колонка журнала UUID: ссылаться нечем.
        entityId: null,
        before: {
          openingBalance: before === null ? 0 : toKopecks(before.openingBalance, 'начальное сальдо фонда'),
          startDate: before?.startDate == null ? null : toIsoDate(before.startDate),
        },
        after: {
          openingBalance: fundOpeningBalance,
          startDate,
          // §4.2: осознанная потеря точности фиксируется пометкой equal-split.
          mode: equalSplit ? 'equal-split' : 'manual',
          balances: participants.map((participant) => ({
            userId: participant.id,
            amount: participant.openingBalance,
          })),
        },
      });
    });

    ctx.invalidateFundState();
    return (await ctx.fundState()).input.fund;
  },

  /**
   * Новый участник (§6.7): ФИО, отдел, почта и сразу — учётные данные.
   *
   * Логин и пароль администратор получил от `suggestCredentials` и, возможно,
   * поправил; здесь они проверяются заново. Пароль в открытом виде уходит
   * только в ответ, в журнал аудита — лишь логин.
   *
   * Ненулевое начальное сальдо той же транзакцией увеличивает начальное сальдо
   * фонда (§4.2): у человека есть остаток ровно потому, что его деньги уже лежат
   * в кассе. Без этого `Σ балансов` мгновенно разошлась бы с фондом.
   */
  addParticipant: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const profile = readProfile(input.profile);
    const joined = requireDate(input.joinedAt, 'joinedAt');
    const opening = requireMoney(input.openingBalance ?? 0, 'openingBalance');
    const login = await requireCredentials(ctx.db, input.login, input.password);
    await requireFreeEmail(ctx.db, profile.email);

    const { data, credentials } = await credentialFields(ctx.config, login, input.password, new Date());

    const created = await ctx.db.$transaction(async (tx) => {
      const departmentId = await resolveDepartment(tx, profile);
      const row = await tx.user.create({
        data: {
          ...data,
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          email: profile.email,
          departmentId,
          role: 'PARTICIPANT',
          joinedAt: fromIsoDate(joined),
          openingBalance: toBigIntKopecks(opening, 'начальное сальдо участника'),
        },
      });

      await shiftFundOpeningBalance(tx, opening);

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.add',
        entity: 'user',
        entityId: row.id,
        after: {
          login,
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          email: profile.email,
          departmentId,
          joinedAt: joined,
          openingBalance: opening,
        },
      });

      return row;
    });

    ctx.invalidateFundState();
    return {
      user: created,
      credentials: { ...credentials, magicLinkExpiresAt: credentials.magicLinkExpiresAt.toISOString() },
    };
  },

  /**
   * Исключение из состава (§6.7): проставляется `leftAt`, строка остаётся.
   *
   * Взносы и доли в прошлых заказах никуда не деваются, доступ к своему остатку
   * человек сохраняет. Со дня выхода он перестаёт получать доли в новых заказах —
   * это делает уже ядро расчёта, здесь только дата.
   */
  deactivateParticipant: async (_parent, { id, leftAt }, ctx) => {
    const admin = await requireAdmin(ctx);
    const date = requireDate(leftAt, 'leftAt');

    const user = await loadParticipant(ctx.db, id);
    if (user.leftAt !== null) {
      throw conflict('Участник уже исключён.', { id, leftAt: toIsoDate(user.leftAt) });
    }
    if (compareDates(date, toIsoDate(user.joinedAt)) < 0) {
      throw badInput('Дата выхода не может быть раньше даты вступления.', { field: 'leftAt' });
    }
    if (user.role === 'ADMIN' && (await otherActiveAdmins(ctx.db, id)) === 0) {
      // Исключить последнего администратора — то же самое, что разжаловать его:
      // панель §6.7 останется без хозяина, а вернуть его будет некому.
      throw conflict(LAST_ADMIN, { id });
    }

    const updated = await ctx.db.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: { leftAt: fromIsoDate(date) } });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.deactivate',
        entity: 'user',
        entityId: id,
        before: { leftAt: null },
        after: { leftAt: date },
      });

      return row;
    });

    ctx.invalidateFundState();
    return updated;
  },

  /** «Вернуть» из §6.7: снятие `leftAt`. Человек вернулся в офис. */
  reactivateParticipant: async (_parent, { id }, ctx) => {
    const admin = await requireAdmin(ctx);

    const user = await loadParticipant(ctx.db, id);
    if (user.leftAt === null) {
      throw conflict('Участник и так в составе.', { id });
    }

    const before = toIsoDate(user.leftAt);

    const updated = await ctx.db.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: { leftAt: null } });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.reactivate',
        entity: 'user',
        entityId: id,
        before: { leftAt: before },
        after: { leftAt: null },
      });

      return row;
    });

    // Дни присутствия считаются от текущего состава, поэтому доли в открытом
    // периоде пересчитываются сразу же.
    ctx.invalidateFundState();
    return updated;
  },

  /**
   * Назначить администратором или разжаловать (§6.7).
   *
   * Последнего действующего администратора разжаловать нельзя: система осталась
   * бы без единственной роли, которая умеет это исправить.
   */
  setParticipantRole: async (_parent, { id, role }, ctx) => {
    const admin = await requireAdmin(ctx);

    const user = await loadParticipant(ctx.db, id);
    if (user.role === role) {
      // Повторное нажатие — не ошибка, но и записи в журнал не заслуживает.
      return user;
    }
    if (role === 'PARTICIPANT' && (await otherActiveAdmins(ctx.db, id)) === 0) {
      throw conflict(LAST_ADMIN, { id });
    }
    if (role === 'ADMIN' && user.restriction !== 'NONE') {
      // Администратор с мьютом или баном — противоречие: ограничение
      // администратору не ставится (`setParticipantRestriction`).
      throw conflict('Сначала снимите с участника ограничение.', { id });
    }

    return ctx.db.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: { role } });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.role',
        entity: 'user',
        entityId: id,
        before: { role: user.role },
        after: { role },
      });

      return row;
    });
    // Роль на деньги не влияет — пересчёт сбрасывать незачем.
  },

  /**
   * Выплата остатка (§6.7): запись `SETTLEMENT` в журнале операций.
   *
   * Сумма обязана быть отрицательной (§2.3, §4.5) — деньги уходят из фонда.
   * Больше текущего остатка выплатить нельзя: это уже не возврат, а новый долг
   * участника, и почти всегда — опечатка в числе.
   */
  settleParticipant: async (_parent, { id, amount, note }, ctx) => {
    const admin = await requireAdmin(ctx);

    const value = requireNegativeMoney(amount, 'amount');
    const comment = requireText(note, 'note');

    const user = await loadParticipant(ctx.db, id);
    const balance = (await ctx.fundState()).balanceOf(id);
    if (balance === null) {
      throw notFound('Баланс участника не найден.', { id });
    }
    if (-value > balance.amount) {
      throw conflict('Выплатить больше остатка нельзя.', {
        id,
        balance: balance.amount,
        amount: value,
      });
    }

    await ctx.db.$transaction(async (tx) => {
      const row = await tx.fundTransaction.create({
        data: {
          type: 'SETTLEMENT',
          amount: toBigIntKopecks(value, 'сумма выплаты'),
          userId: id,
          comment,
          createdBy: admin.id,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'participant.settle',
        entity: 'fund_transaction',
        entityId: row.id,
        after: { userId: id, amount: value, comment, balanceBefore: balance.amount },
      });
    });

    ctx.invalidateFundState();
    return user;
  },

  /**
   * Корректировка (§2.4): встречная запись, которой гасится ошибка учёта.
   *
   * `userId = null` — «деньги неизвестного происхождения». Такая корректировка
   * делится поровну между активными на дату операции; делает это ядро расчёта
   * (`fundLevelRecipients`), здесь ничего считать не нужно. Комментарий
   * обязателен: запись без объяснения через месяц не отличить от ошибки.
   */
  createAdjustment: async (_parent, { userId, amount, comment }, ctx) => {
    const admin = await requireAdmin(ctx);

    const value = requireNonZeroMoney(amount, 'amount');
    const text = requireText(comment, 'comment');

    if (userId != null) {
      await loadParticipant(ctx.db, userId);
    } else {
      // Разделить не на кого — ядро бросит при следующем пересчёте, поэтому
      // отказываем сразу и с внятным сообщением.
      const participants = await ctx.db.user.count();
      if (participants === 0) {
        throw conflict('Корректировку без участника делить не на кого: состав пуст.');
      }
    }

    await ctx.db.$transaction(async (tx) => {
      const row = await tx.fundTransaction.create({
        data: {
          type: 'ADJUSTMENT',
          amount: toBigIntKopecks(value, 'сумма корректировки'),
          userId: userId ?? null,
          comment: text,
          createdBy: admin.id,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'fund.adjust',
        entity: 'fund_transaction',
        entityId: row.id,
        after: { userId: userId ?? null, amount: value, comment: text },
      });
    });

    ctx.invalidateFundState();
    return (await ctx.fundState()).input.fund;
  },

  /**
   * Взнос, внесённый администратором за участника (§6.7).
   *
   * Статус — `RECORDED`: запись администратора и есть подтверждение, ждать
   * второго взгляда ей незачем (решение ADR-0005). Поэтому, как и при
   * `confirmContribution`, строка `CONTRIBUTION` в журнале операций пишется
   * здесь же и в той же транзакции: разъехавшись, взнос и деньги дали бы
   * расхождение инварианта. Запись помечается `enteredByAdmin`, а в журнал
   * аудита попадает и кто внёс, и за кого.
   */
  addContributionFor: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const value = requirePositiveMoney(input.amount, 'amount');
    const date = requireDate(input.paidAt, 'paidAt');
    const user = await loadParticipant(ctx.db, input.userId);

    if (input.receiptFileId != null) {
      const receipt = await ctx.loaders.receiptById.load(input.receiptFileId);
      if (receipt === null) {
        throw notFound('Чек не найден. Загрузите файл заново.', { receiptFileId: input.receiptFileId });
      }
    }

    const created = await ctx.db.$transaction(async (tx) => {
      const row = await tx.contribution.create({
        data: {
          userId: user.id,
          amount: toBigIntKopecks(value, 'сумма взноса'),
          paidAt: fromIsoDate(date),
          status: 'RECORDED',
          receiptId: input.receiptFileId ?? null,
          enteredByAdmin: true,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });

      // Момент, в который деньги появляются в фонде (§2.3, правило 6).
      await tx.fundTransaction.create({
        data: {
          type: 'CONTRIBUTION',
          amount: row.amount,
          userId: row.userId,
          refId: row.id,
          createdBy: admin.id,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'contribution.submit.for',
        entity: 'contribution',
        entityId: row.id,
        after: {
          userId: user.id,
          amount: value,
          paidAt: date,
          status: 'RECORDED',
          enteredByAdmin: true,
        },
      });

      return row;
    });

    ctx.invalidateFundState();
    return created;
  },

  /**
   * Отсутствие, внесённое администратором за участника (§6.7).
   *
   * Пересечения запрещены базой (`EXCLUDE USING gist`, §11); запрос вперёд —
   * ради внятного сообщения, исключение базы ловится вторым рубежом на случай
   * гонки двух одновременных запросов.
   */
  addAbsenceFor: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const from = requireDate(input.startsOn, 'startsOn');
    const to = requireDate(input.endsOn, 'endsOn');
    if (compareDates(to, from) < 0) {
      throw badInput('Дата окончания не может быть раньше даты начала.', { field: 'endsOn' });
    }

    const user = await loadParticipant(ctx.db, input.userId);

    const overlapping = await ctx.db.absence.findFirst({
      where: {
        userId: user.id,
        startsOn: { lte: fromIsoDate(to) },
        endsOn: { gte: fromIsoDate(from) },
      },
    });
    if (overlapping !== null) {
      throw overlapError(from, to);
    }

    try {
      const created = await ctx.db.$transaction(async (tx) => {
        const row = await tx.absence.create({
          data: {
            userId: user.id,
            type: input.type,
            startsOn: fromIsoDate(from),
            endsOn: fromIsoDate(to),
            note: input.note?.trim() || null,
            enteredByAdmin: true,
          } satisfies Prisma.AbsenceUncheckedCreateInput,
        });

        await writeAudit(tx, {
          actorId: admin.id,
          action: 'absence.add.for',
          entity: 'absence',
          entityId: row.id,
          after: {
            userId: user.id,
            type: input.type,
            startsOn: from,
            endsOn: to,
            enteredByAdmin: true,
          },
        });

        return row;
      });

      ctx.invalidateFundState();
      return created;
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw overlapError(from, to);
      }
      throw error;
    }
  },
};
