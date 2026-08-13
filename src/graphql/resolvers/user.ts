import type { GraphQLContext } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { UserResolvers } from '@/graphql/generated/graphql';
import { toIsoDate, toIsoDateOrNull, toKopecks } from '@/lib/data';

/**
 * Поля `User`, которых нет в строке таблицы: вычисляемые, связи и баланс.
 *
 * Связи идут через лоадеры (§10.3): без них запрос
 * `participants { absences { … } }` на пятнадцать человек дал бы пятнадцать
 * походов в базу вместо одного.
 */
export const User: UserResolvers<GraphQLContext> = {
  /** Участник числится в составе, если не проставлена дата выхода. */
  isActive: (parent) => parent.leftAt === null,

  // Даты в базе — DATE без времени; наружу отдаём YYYY-MM-DD.
  joinedAt: (parent) => toIsoDate(parent.joinedAt),
  leftAt: (parent) => toIsoDateOrNull(parent.leftAt),

  openingBalance: (parent) => toKopecks(parent.openingBalance, `начальное сальдо ${parent.id}`),

  balance: async (parent, _args, ctx) => {
    const balance = (await ctx.fundState()).balanceOf(parent.id);
    if (balance === null) {
      // Пересчёт берёт всех участников из той же таблицы, так что сюда можно
      // попасть только при гонке с удалением строки — физического удаления
      // участника в приложении нет (§6.7).
      throw notFound(`Баланс участника ${parent.id} не найден.`, { userId: parent.id });
    }
    return balance;
  },

  absences: (parent, _args, ctx) => ctx.loaders.absencesByUserId.load(parent.id),

  contributions: async (parent, { status }, ctx) => {
    const rows = await ctx.loaders.contributionsByUserId.load(parent.id);
    // Фильтр в памяти, а не в запросе: лоадер уже сходил за всеми взносами
    // участника, и второй поход ради подмножества — чистые потери.
    return status == null ? rows : rows.filter((row) => row.status === status);
  },
};
