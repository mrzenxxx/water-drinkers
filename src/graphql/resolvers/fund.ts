import type { GraphQLContext } from '@/graphql/context';
import type { FundResolvers } from '@/graphql/generated/graphql';
import { monthlyStats } from '@/lib/data';

/**
 * Поля `Fund`, которые не лежат в строке `fund_settings`.
 *
 * Родитель — уже переведённые настройки фонда из `CalcInput`, поэтому
 * `openingBalance`, `startDate` и `defaultContribution` резолвера не требуют.
 *
 * `balance` и `balancesSum` намеренно приходят из одного пересчёта: §6.4 и §5
 * обещают показать обе величины рядом и отметку схождения. Считать их разными
 * путями — значит проверять инвариант ничем.
 */
export const Fund: FundResolvers<GraphQLContext> = {
  balance: async (_parent, _args, ctx) => (await ctx.fundState()).result.fundBalance,

  balancesSum: async (_parent, _args, ctx) => (await ctx.fundState()).invariant.balancesSum,

  isConsistent: async (_parent, _args, ctx) => (await ctx.fundState()).invariant.isConsistent,

  monthlyStats: async (_parent, _args, ctx) => {
    const state = await ctx.fundState();
    return monthlyStats(state.input, state.result);
  },
};
