import type { GraphQLContext } from '@/graphql/context';
import type { AuditEntryResolvers } from '@/graphql/generated/graphql';
import { toIsoDateTime } from '@/lib/data';

export const AuditEntry: AuditEntryResolvers<GraphQLContext> = {
  // BIGSERIAL приходит BigInt-ом, а ID в GraphQL — строка.
  id: (parent) => String(parent.id),
  createdAt: (parent) => toIsoDateTime(parent.createdAt),

  /** `null` — системное действие: сиды и служебные операции без автора. */
  actor: (parent, _args, ctx) =>
    parent.actorId === null ? null : ctx.loaders.userById.load(parent.actorId),
};
