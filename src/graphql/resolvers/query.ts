import type { GraphQLContext } from '@/graphql/context';
import type { QueryResolvers } from '@/graphql/generated/graphql';

/**
 * `me` работает с этапа 2. Остальное — заглушки: пустые списки и нули.
 * Настоящие данные появляются на этапе 3, расчёт опирается на src/lib/calc.
 */
export const Query: QueryResolvers<GraphQLContext> = {
  me: async (_parent, _args, ctx) => {
    if (ctx.userId === null) return null;
    return ctx.db.user.findUnique({ where: { id: ctx.userId } });
  },
  fund: () => ({
    balance: 0,
    openingBalance: 0,
    migrationDate: null,
    defaultContribution: 0,
    balancesSum: 0,
    isConsistent: true,
    monthlyStats: [],
  }),
  participants: () => [],
  balances: () => [],
  contributions: () => [],
  waterOrders: () => [],
  absences: () => [],
  pendingContributions: () => [],
  auditLog: () => [],
  assistantThread: () => [],
};
