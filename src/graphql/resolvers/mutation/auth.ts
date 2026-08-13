import { GraphQLError } from 'graphql';

import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import { badInput } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth';

/** Человеческие формулировки отказов при вводе кода. */
const VERIFY_MESSAGES: Record<string, string> = {
  no_code: 'Код не запрашивался или уже использован. Запросите новый.',
  expired: 'Срок действия кода истёк. Запросите новый.',
  too_many_attempts: 'Слишком много неверных попыток. Запросите новый код.',
  wrong_code: 'Неверный код.',
};

/** Вход по одноразовым кодам (§7). Реализовано на этапе 2. */
export const authMutations: Pick<
  MutationResolvers<GraphQLContext>,
  'requestLoginCode' | 'verifyLoginCode' | 'logout' | 'updateProfile'
> = {
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
      throw badInput('Имя и фамилия не могут быть пустыми.');
    }

    const updated = await ctx.db.user.update({
      where: { id: user.id },
      data: { firstName: first, lastName: last },
    });

    // Лоадер держит строку участника с начала запроса; без подмены `me`
    // в том же ответе показал бы старое имя.
    ctx.loaders.userById.clear(user.id).prime(user.id, updated);
    return updated;
  },
};
