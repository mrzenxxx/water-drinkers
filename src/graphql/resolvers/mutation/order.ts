import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin } from '@/graphql/context';
import { badInput, notFound, requireDate, requirePositiveMoney } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { fromIsoDate, toBigIntKopecks, writeAudit } from '@/lib/data';

/**
 * Заказы воды — списание из фонда (§2.3, §6.5). Вносит только администратор (§3).
 *
 * Сумма в `water_orders` хранится **положительной** (`CHECK (amount > 0)`, §11),
 * а в журнале операций та же сумма ложится со знаком минус (§4.5): деньги ушли.
 * Смешивать «знак в поле» с «минусом в формуле» нельзя — именно на этом
 * инвариант ломается тише всего, поэтому знак ставится ровно здесь и один раз.
 *
 * Заказ распределяется на 100 % сразу (§4.4): деньги ушли из фонда, значит
 * балансы обязаны отреагировать в тот же момент, а не по итогам периода.
 */
export const orderMutations: Pick<MutationResolvers<GraphQLContext>, 'createWaterOrder'> = {
  createWaterOrder: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const amount = requirePositiveMoney(input.amount, 'amount');
    const orderedAt = requireDate(input.orderedAt, 'orderedAt');

    if (input.bottlesCount != null && (!Number.isSafeInteger(input.bottlesCount) || input.bottlesCount <= 0)) {
      throw badInput('Количество бутылей должно быть целым положительным числом.', {
        field: 'bottlesCount',
      });
    }

    if (input.receiptFileId != null) {
      const receipt = await ctx.loaders.receiptById.load(input.receiptFileId);
      if (receipt === null) {
        throw notFound('Чек не найден. Загрузите файл заново.', { receiptFileId: input.receiptFileId });
      }
    }

    const created = await ctx.db.$transaction(async (tx) => {
      const row = await tx.waterOrder.create({
        data: {
          amount: toBigIntKopecks(amount, 'сумма заказа'),
          orderedAt: fromIsoDate(orderedAt),
          bottlesCount: input.bottlesCount ?? null,
          supplier: input.supplier?.trim() || null,
          note: input.note?.trim() || null,
          receiptId: input.receiptFileId ?? null,
          createdBy: admin.id,
        },
      });

      await tx.fundTransaction.create({
        data: {
          type: 'ORDER',
          amount: toBigIntKopecks(-amount, 'сумма операции'),
          refId: row.id,
          createdBy: admin.id,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'order.create',
        entity: 'water_order',
        entityId: row.id,
        after: { amount, orderedAt, bottlesCount: input.bottlesCount ?? null },
      });

      return row;
    });

    ctx.invalidateFundState();
    return created;
  },
};
