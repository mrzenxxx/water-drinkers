import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin, requireWriter } from '@/graphql/context';
import { conflict, notFound, notImplemented, requireDate, requirePositiveMoney, requireText } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { requireWriteQuota } from '@/graphql/write-quota';
import { fromIsoDate, toBigIntKopecks, writeAudit } from '@/lib/data';

/**
 * Взносы: подача участником и модерация администратором (§6.2, §6.7).
 *
 * Здесь живёт правило 6 CLAUDE.md: **взнос влияет на баланс только после
 * подтверждения**. Технически это значит, что строка `fund_transactions`
 * типа `CONTRIBUTION` пишется не при подаче, а в момент подтверждения, и
 * обязательно в одной транзакции со сменой статуса. Разъехавшись, эти две
 * записи дали бы либо деньги без взноса, либо взнос без денег.
 *
 * Отклонённый и подтверждённый взнос заново не рассматриваются: журнал операций
 * неизменяем (правило 4), и ошибочное подтверждение гасится встречной записью
 * `ADJUSTMENT` (§2.4) — отдельной мутацией администратора, а не откатом статуса.
 */
export const contributionMutations: Pick<
  MutationResolvers<GraphQLContext>,
  'submitContribution' | 'confirmContribution' | 'rejectContribution' | 'extractReceipt'
> = {
  submitContribution: async (_parent, { amount, paidAt, receiptFileId }, ctx) => {
    const user = await requireWriter(ctx);
    const value = requirePositiveMoney(amount, 'amount');
    const date = requireDate(paidAt, 'paidAt');

    if (receiptFileId != null) {
      const receipt = await ctx.loaders.receiptById.load(receiptFileId);
      if (receipt === null) {
        throw notFound('Чек не найден. Загрузите файл заново.', { receiptFileId });
      }
    }

    await requireWriteQuota(ctx, user, 'contribution.submit');

    const created = await ctx.db.$transaction(async (tx) => {
      const row = await tx.contribution.create({
        data: {
          userId: user.id,
          amount: toBigIntKopecks(value, 'сумма взноса'),
          paidAt: fromIsoDate(date),
          status: 'PENDING',
          receiptId: receiptFileId ?? null,
        },
      });

      await writeAudit(tx, {
        actorId: user.id,
        action: 'contribution.submit',
        entity: 'contribution',
        entityId: row.id,
        after: { amount: value, paidAt: date, status: 'PENDING' },
      });

      return row;
    });

    // Записи в журнале операций нет и быть не должно: до подтверждения деньги
    // фондом не считаются. Пересчёт всё равно сбрасываем — список взносов
    // в этом же ответе обязан показать новую строку.
    ctx.invalidateFundState();
    return created;
  },

  confirmContribution: async (_parent, { id }, ctx) => {
    const admin = await requireAdmin(ctx);

    const confirmed = await ctx.db.$transaction(async (tx) => {
      const existing = await tx.contribution.findUnique({ where: { id } });
      if (existing === null) {
        throw notFound('Взнос не найден.', { id });
      }
      if (existing.status !== 'PENDING') {
        throw conflict('Взнос уже рассмотрен. Исправление — встречной корректировкой (§2.4).', {
          id,
          status: existing.status,
        });
      }

      const row = await tx.contribution.update({
        where: { id },
        data: { status: 'CONFIRMED', reviewedBy: admin.id, reviewedAt: new Date() },
      });

      // Момент, в который деньги появляются в фонде (§2.3, правило 6).
      await tx.fundTransaction.create({
        data: {
          type: 'CONTRIBUTION',
          amount: row.amount,
          userId: row.userId,
          refId: row.id,
          createdBy: admin.id,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'contribution.confirm',
        entity: 'contribution',
        entityId: row.id,
        before: { status: existing.status },
        after: { status: 'CONFIRMED' },
      });

      return row;
    });

    ctx.invalidateFundState();
    return confirmed;
  },

  rejectContribution: async (_parent, { id, comment }, ctx) => {
    const admin = await requireAdmin(ctx);
    // Комментарий обязателен: §6.2 обещает участнику причину отказа.
    const reason = requireText(comment, 'comment');

    const rejected = await ctx.db.$transaction(async (tx) => {
      const existing = await tx.contribution.findUnique({ where: { id } });
      if (existing === null) {
        throw notFound('Взнос не найден.', { id });
      }
      if (existing.status !== 'PENDING') {
        throw conflict('Взнос уже рассмотрен.', { id, status: existing.status });
      }

      const row = await tx.contribution.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          reviewComment: reason,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'contribution.reject',
        entity: 'contribution',
        entityId: row.id,
        before: { status: existing.status },
        after: { status: 'REJECTED', reviewComment: reason },
      });

      return row;
    });

    // Отклонённый взнос денег не двигал, но список на экране изменился.
    ctx.invalidateFundState();
    return rejected;
  },

  // Распознавание чеков — этап 6 (§8).
  extractReceipt: () => notImplemented('extractReceipt'),
};
