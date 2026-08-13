import type { GraphQLContext } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { ContributionResolvers, ContributionStatus } from '@/graphql/generated/graphql';
import { toContributionStatus, toIsoDate, toIsoDateTime, toIsoDateTimeOrNull, toKopecks } from '@/lib/data';

import { parseExtraction } from './receipt';

export const Contribution: ContributionResolvers<GraphQLContext> = {
  amount: (parent) => toKopecks(parent.amount, `сумма взноса ${parent.id}`),
  paidAt: (parent) => toIsoDate(parent.paidAt),
  status: (parent) => toContributionStatus(parent.status) as ContributionStatus,
  submittedAt: (parent) => toIsoDateTime(parent.submittedAt),
  reviewedAt: (parent) => toIsoDateTimeOrNull(parent.reviewedAt),

  user: async (parent, _args, ctx) => {
    const user = await ctx.loaders.userById.load(parent.userId);
    if (user === null) {
      throw notFound(`Участник ${parent.userId} не найден.`, { userId: parent.userId });
    }
    return user;
  },

  reviewedBy: (parent, _args, ctx) =>
    parent.reviewedBy === null ? null : ctx.loaders.userById.load(parent.reviewedBy),

  receipt: (parent, _args, ctx) =>
    parent.receiptId === null ? null : ctx.loaders.receiptById.load(parent.receiptId),

  /**
   * «Требует внимания» из §8.3 и §6.7: распознавание сработало плохо либо
   * разошлось с тем, что человек ввёл руками.
   *
   * Взнос без чека сюда не попадает: сравнивать не с чем, а метка «внимание»
   * на половине очереди перестала бы что-либо значить.
   */
  needsAttention: async (parent, _args, ctx) => {
    if (parent.receiptId === null) return false;

    const receipt = await ctx.loaders.receiptById.load(parent.receiptId);
    const extraction = parseExtraction(receipt?.extraction ?? null);
    if (extraction === null) return false;

    if (extraction.confidence === 'LOW') return true;

    const amountDiffers =
      extraction.amountKopecks !== null &&
      extraction.amountKopecks !== toKopecks(parent.amount, `сумма взноса ${parent.id}`);
    const dateDiffers = extraction.paidAt !== null && extraction.paidAt !== toIsoDate(parent.paidAt);

    return amountDiffers || dateDiffers;
  },
};
