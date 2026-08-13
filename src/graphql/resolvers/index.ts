import type { Resolvers } from '@/graphql/generated/graphql';
import { Absence } from '@/graphql/resolvers/absence';
import { AuditEntry } from '@/graphql/resolvers/audit';
import { Balance, OrderShare } from '@/graphql/resolvers/balance';
import { Contribution } from '@/graphql/resolvers/contribution';
import { Fund } from '@/graphql/resolvers/fund';
import { Mutation } from '@/graphql/resolvers/mutation';
import { Query } from '@/graphql/resolvers/query';
import { Receipt } from '@/graphql/resolvers/receipt';
import { User } from '@/graphql/resolvers/user';
import { WaterOrder } from '@/graphql/resolvers/water-order';
import { DateScalar, DateTimeScalar, JSONScalar, MoneyScalar } from '@/graphql/scalars';

/**
 * `BalanceBreakdown`, `MonthlyStat` и `ReceiptExtraction` резолверов не имеют:
 * их родители — уже готовые объекты с теми же именами полей, и умолчание
 * GraphQL справляется само.
 */
export const resolvers: Resolvers = {
  Date: DateScalar,
  DateTime: DateTimeScalar,
  Money: MoneyScalar,
  JSON: JSONScalar,

  Query,
  Mutation,

  User,
  Fund,
  Balance,
  OrderShare,
  Contribution,
  Receipt,
  WaterOrder,
  Absence,
  AuditEntry,
};
