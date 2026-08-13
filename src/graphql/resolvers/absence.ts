import type { GraphQLContext } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { AbsenceResolvers, AbsenceType } from '@/graphql/generated/graphql';
import { toAbsenceType, toIsoDate } from '@/lib/data';

export const Absence: AbsenceResolvers<GraphQLContext> = {
  type: (parent) => toAbsenceType(parent.type) as AbsenceType,
  startsOn: (parent) => toIsoDate(parent.startsOn),
  endsOn: (parent) => toIsoDate(parent.endsOn),

  user: async (parent, _args, ctx) => {
    const user = await ctx.loaders.userById.load(parent.userId);
    if (user === null) {
      throw notFound(`Участник ${parent.userId} не найден.`, { userId: parent.userId });
    }
    return user;
  },
};
