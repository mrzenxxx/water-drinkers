import type { Resolvers } from '@/graphql/generated/graphql';
import { Mutation } from '@/graphql/resolvers/mutation';
import { Query } from '@/graphql/resolvers/query';
import { User } from '@/graphql/resolvers/user';
import { DateScalar, DateTimeScalar, JSONScalar, MoneyScalar } from '@/graphql/scalars';

export const resolvers: Resolvers = {
  Date: DateScalar,
  DateTime: DateTimeScalar,
  Money: MoneyScalar,
  JSON: JSONScalar,
  Query,
  Mutation,
  User,
};
