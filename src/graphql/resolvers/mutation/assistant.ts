import type { GraphQLContext } from '@/graphql/context';
import { notImplemented } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';

/** Помощник — этап 7 (§9). */
export const assistantMutations: Pick<MutationResolvers<GraphQLContext>, 'askAssistant'> = {
  askAssistant: () => notImplemented('askAssistant'),
};
