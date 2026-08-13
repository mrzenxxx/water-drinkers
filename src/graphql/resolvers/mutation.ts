import { GraphQLError } from 'graphql';

import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth';

/**
 * Мутация ещё не реализована. Возвращать выдуманную сущность вместо ответа
 * опаснее, чем честно отказать: клиент принял бы пустышку за настоящие данные.
 * Код ошибки — в extensions (§10.3), а не строкой в сообщении.
 */
function notImplemented(name: string): never {
  throw new GraphQLError(`Mutation "${name}" is not implemented yet`, {
    extensions: { code: 'NOT_IMPLEMENTED' },
  });
}

/** Человеческие формулировки отказов при вводе кода. */
const VERIFY_MESSAGES: Record<string, string> = {
  no_code: 'Код не запрашивался или уже использован. Запросите новый.',
  expired: 'Срок действия кода истёк. Запросите новый.',
  too_many_attempts: 'Слишком много неверных попыток. Запросите новый код.',
  wrong_code: 'Неверный код.',
};

export const Mutation: MutationResolvers<GraphQLContext> = {
  // ─── Аутентификация (этап 2) ───────────────────────────

  requestLoginCode: async (_parent, { email }, ctx) => {
    return requestLoginCode(ctx.db, ctx.config, email);
  },

  verifyLoginCode: async (_parent, { email, code }, ctx) => {
    const result = await verifyLoginCode(ctx.db, ctx.config, email, code);

    if (!result.ok) {
      throw new GraphQLError(VERIFY_MESSAGES[result.reason] ?? 'Не удалось войти.', {
        extensions: { code: 'INVALID_LOGIN_CODE', reason: result.reason },
      });
    }

    await ctx.setSessionCookie(result.token);

    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: result.userId } });
    return { user, needsProfile: result.needsProfile };
  },

  logout: async (_parent, _args, ctx) => {
    await ctx.clearSessionCookie();
    return true;
  },

  updateProfile: async (_parent, { firstName, lastName }, ctx) => {
    const user = await requireUser(ctx);

    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length === 0 || last.length === 0) {
      throw new GraphQLError('Имя и фамилия не могут быть пустыми.', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    return ctx.db.user.update({
      where: { id: user.id },
      data: { firstName: first, lastName: last },
    });
  },

  // ─── Взносы — этапы 3 и 6 ──────────────────────────────
  extractReceipt: () => notImplemented('extractReceipt'),
  submitContribution: () => notImplemented('submitContribution'),
  confirmContribution: () => notImplemented('confirmContribution'),
  rejectContribution: () => notImplemented('rejectContribution'),

  // ─── Заказы — этап 3 ───────────────────────────────────
  createWaterOrder: () => notImplemented('createWaterOrder'),

  // ─── Отсутствия — этап 3 ───────────────────────────────
  addAbsence: () => notImplemented('addAbsence'),
  deleteAbsence: () => false,

  // ─── Администрирование — этапы 3 и 4 ───────────────────
  runMigration: () => notImplemented('runMigration'),
  addParticipant: () => notImplemented('addParticipant'),
  deactivateParticipant: () => notImplemented('deactivateParticipant'),
  settleParticipant: () => notImplemented('settleParticipant'),
  createAdjustment: () => notImplemented('createAdjustment'),

  // ─── Помощник — этап 7 ─────────────────────────────────
  askAssistant: () => notImplemented('askAssistant'),
};
