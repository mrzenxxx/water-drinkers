import type { GraphQLContext } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { BalanceResolvers, OrderShareResolvers } from '@/graphql/generated/graphql';

/**
 * `Balance` и `OrderShare` приходят из ядра расчёта, а не из таблицы: их
 * родитель — результат `computeBalances`. Скалярные поля совпадают по именам
 * и разрешаются сами; резолверы нужны только связям.
 *
 * `BalanceBreakdown` резолверов не требует вовсе — имена полей ядра и схемы
 * совпадают дословно.
 */
export const Balance: BalanceResolvers<GraphQLContext> = {
  user: async (parent, _args, ctx) => {
    const user = await ctx.loaders.userById.load(parent.userId);
    if (user === null) {
      throw notFound(`Участник ${parent.userId} не найден.`, { userId: parent.userId });
    }
    return user;
  },
};

export const OrderShare: OrderShareResolvers<GraphQLContext> = {
  order: async (parent, _args, ctx) => {
    const order = await ctx.loaders.waterOrderById.load(parent.orderId);
    if (order === null) {
      throw notFound(`Заказ ${parent.orderId} не найден.`, { orderId: parent.orderId });
    }
    return order;
  },
};
