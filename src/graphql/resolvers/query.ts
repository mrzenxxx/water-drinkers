import type { QueryResolvers } from '@/graphql/generated/graphql';

/**
 * Заглушки этапа 0: пустые списки и нули. Настоящие данные появляются
 * на этапе 3, расчёт балансов опирается на src/lib/calc (этап 1).
 */
export const Query: QueryResolvers = {
  me: () => null,
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
