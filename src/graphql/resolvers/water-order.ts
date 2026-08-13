import type { GraphQLContext } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { WaterOrderResolvers } from '@/graphql/generated/graphql';
import { toIsoDate, toKopecks } from '@/lib/data';

export const WaterOrder: WaterOrderResolvers<GraphQLContext> = {
  amount: (parent) => toKopecks(parent.amount, `сумма заказа ${parent.id}`),
  orderedAt: (parent) => toIsoDate(parent.orderedAt),

  createdBy: async (parent, _args, ctx) => {
    const user = await ctx.loaders.userById.load(parent.createdBy);
    if (user === null) {
      throw notFound(`Участник ${parent.createdBy} не найден.`, { userId: parent.createdBy });
    }
    return user;
  },

  receipt: (parent, _args, ctx) =>
    parent.receiptId === null ? null : ctx.loaders.receiptById.load(parent.receiptId),

  /**
   * Конец периода потребления (§4.3) — дата следующего заказа. Интервал
   * полуоткрытый, поэтому этот день уже относится к следующему заказу и здесь
   * показан как граница, а не как последний оплаченный день.
   *
   * `null` — период последнего заказа ещё идёт, доли в нём пересчитываются
   * каждый день (§4.4).
   */
  consumptionPeriodEnd: async (parent, _args, ctx) => {
    const period = (await ctx.fundState()).periodOf(parent.id);
    if (period === null || period.isOpen) return null;
    return period.period.to;
  },

  /**
   * Раскладка заказа по участникам. Пустая — у заказа, который расчёт не
   * учитывает: помеченного `historical` или сделанного до даты начала учёта (§4.2).
   */
  shares: async (parent, _args, ctx) => {
    const period = (await ctx.fundState()).periodOf(parent.id);
    return period === null ? [] : [...period.shares];
  },
};
