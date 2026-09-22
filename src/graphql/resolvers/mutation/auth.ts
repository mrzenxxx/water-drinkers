import { GraphQLError } from 'graphql';

import type { GraphQLContext } from '@/graphql/context';
import { requireWriter } from '@/graphql/context';
import { badInput } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { LOCK_MINUTES, loginWithPassword } from '@/lib/auth';

/** Человеческие формулировки отказов при входе. */
const LOGIN_MESSAGES: Record<string, string> = {
  invalid: 'Неверный логин или пароль.',
  locked: `Слишком много неудачных попыток. Попробуйте через ${LOCK_MINUTES} минут.`,
  banned: 'Доступ закрыт администратором.',
};

/** Вход по логину и паролю, выданным администратором (§7, ADR-0004). */
export const authMutations: Pick<
  MutationResolvers<GraphQLContext>,
  'login' | 'logout' | 'updateProfile'
> = {
  login: async (_parent, { login, password }, ctx) => {
    const result = await loginWithPassword(ctx.db, ctx.config, login, password);

    if (!result.ok) {
      throw new GraphQLError(LOGIN_MESSAGES[result.reason] ?? 'Не удалось войти.', {
        extensions: { code: 'INVALID_CREDENTIALS', reason: result.reason },
      });
    }

    await ctx.setSessionCookie(result.token);

    const user = result.user;
    return { user, needsProfile: user.firstName === null || user.lastName === null };
  },

  logout: async (_parent, _args, ctx) => {
    await ctx.clearSessionCookie();
    return true;
  },

  updateProfile: async (_parent, { firstName, lastName }, ctx) => {
    const user = await requireWriter(ctx);

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
