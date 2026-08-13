import type { GraphQLContext } from '@/graphql/context';
import type { MutationResolvers } from '@/graphql/generated/graphql';

import { absenceMutations } from './absence';
import { adminMutations } from './admin';
import { assistantMutations } from './assistant';
import { authMutations } from './auth';
import { contributionMutations } from './contribution';
import { orderMutations } from './order';

/**
 * Мутации разложены по доменам, а не свалены в один файл: этапы дописывают
 * разные части (администрирование — этап 4, помощник — этап 7), и общий файл
 * превратился бы в место постоянных конфликтов.
 *
 * Схема требует полный набор резолверов, поэтому `Pick` в каждом файле —
 * не украшение: забытая мутация не соберётся здесь по типам.
 */
export const Mutation: MutationResolvers<GraphQLContext> = {
  ...authMutations,
  ...contributionMutations,
  ...orderMutations,
  ...absenceMutations,
  ...adminMutations,
  ...assistantMutations,
};
