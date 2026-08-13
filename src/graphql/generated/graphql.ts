import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { User as PrismaUser, Contribution as PrismaContribution, WaterOrder as PrismaWaterOrder, Absence as PrismaAbsence, Receipt as PrismaReceipt, AuditEntry as PrismaAuditEntry, AssistantMessage as PrismaAssistantMessage } from '@/generated/prisma/client';
import type { GraphQLContext } from '../context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Date: { input: string; output: string; }
  DateTime: { input: string; output: string; }
  JSON: { input: unknown; output: unknown; }
  Money: { input: number; output: number; }
};

export type Absence = {
  __typename?: 'Absence';
  endsOn: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  note?: Maybe<Scalars['String']['output']>;
  startsOn: Scalars['Date']['output'];
  type: AbsenceType;
  user: User;
};

export enum AbsenceType {
  SickLeave = 'SICK_LEAVE',
  Vacation = 'VACATION'
}

/** Сообщение диалога с помощником (assistant_messages, §11). */
export type AssistantMessage = {
  __typename?: 'AssistantMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  role: Scalars['String']['output'];
};

/** Запись журнала аудита (audit_log, §11). В §10.2 тип упомянут, но не расписан. */
export type AuditEntry = {
  __typename?: 'AuditEntry';
  action: Scalars['String']['output'];
  actor?: Maybe<User>;
  after?: Maybe<Scalars['JSON']['output']>;
  before?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['DateTime']['output'];
  entity: Scalars['String']['output'];
  entityId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

/** Результат проверки кода. Сессия уходит в httpOnly-cookie, а не в ответ. */
export type AuthResult = {
  __typename?: 'AuthResult';
  needsProfile: Scalars['Boolean']['output'];
  user: User;
};

export type Balance = {
  __typename?: 'Balance';
  amount: Scalars['Money']['output'];
  breakdown: BalanceBreakdown;
  owes: Scalars['Boolean']['output'];
  user: User;
};

/** Раскрытие баланса — то, что показывает экран «Фонд» по клику */
export type BalanceBreakdown = {
  __typename?: 'BalanceBreakdown';
  contributionsTotal: Scalars['Money']['output'];
  expensesTotal: Scalars['Money']['output'];
  openingBalance: Scalars['Money']['output'];
  orderShares: Array<OrderShare>;
  settlementsTotal: Scalars['Money']['output'];
};

export enum Confidence {
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM'
}

export type Contribution = {
  __typename?: 'Contribution';
  amount: Scalars['Money']['output'];
  id: Scalars['ID']['output'];
  needsAttention: Scalars['Boolean']['output'];
  paidAt: Scalars['Date']['output'];
  receipt?: Maybe<Receipt>;
  reviewComment?: Maybe<Scalars['String']['output']>;
  reviewedAt?: Maybe<Scalars['DateTime']['output']>;
  reviewedBy?: Maybe<User>;
  status: ContributionStatus;
  submittedAt: Scalars['DateTime']['output'];
  user: User;
};

export enum ContributionStatus {
  Confirmed = 'CONFIRMED',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

export type Fund = {
  __typename?: 'Fund';
  balance: Scalars['Money']['output'];
  balancesSum: Scalars['Money']['output'];
  defaultContribution: Scalars['Money']['output'];
  isConsistent: Scalars['Boolean']['output'];
  monthlyStats: Array<MonthlyStat>;
  openingBalance: Scalars['Money']['output'];
  startDate?: Maybe<Scalars['Date']['output']>;
};

export type MonthlyStat = {
  __typename?: 'MonthlyStat';
  contributions: Scalars['Money']['output'];
  endBalance: Scalars['Money']['output'];
  month: Scalars['String']['output'];
  orders: Scalars['Money']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addAbsence: Absence;
  addParticipant: User;
  askAssistant: AssistantMessage;
  confirmContribution: Contribution;
  createAdjustment: Fund;
  createWaterOrder: WaterOrder;
  deactivateParticipant: User;
  deleteAbsence: Scalars['Boolean']['output'];
  extractReceipt: ReceiptExtraction;
  logout: Scalars['Boolean']['output'];
  rejectContribution: Contribution;
  requestLoginCode: RequestCodeResult;
  setOpeningBalances: Fund;
  settleParticipant: User;
  submitContribution: Contribution;
  updateProfile: User;
  verifyLoginCode: AuthResult;
};


export type MutationAddAbsenceArgs = {
  endsOn: Scalars['Date']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  startsOn: Scalars['Date']['input'];
  type: AbsenceType;
};


export type MutationAddParticipantArgs = {
  email: Scalars['String']['input'];
  joinedAt: Scalars['Date']['input'];
};


export type MutationAskAssistantArgs = {
  question: Scalars['String']['input'];
};


export type MutationConfirmContributionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateAdjustmentArgs = {
  amount: Scalars['Money']['input'];
  comment: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateWaterOrderArgs = {
  input: WaterOrderInput;
};


export type MutationDeactivateParticipantArgs = {
  id: Scalars['ID']['input'];
  leftAt: Scalars['Date']['input'];
};


export type MutationDeleteAbsenceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationExtractReceiptArgs = {
  fileId: Scalars['ID']['input'];
};


export type MutationRejectContributionArgs = {
  comment: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationRequestLoginCodeArgs = {
  email: Scalars['String']['input'];
};


export type MutationSetOpeningBalancesArgs = {
  input: OpeningBalancesInput;
};


export type MutationSettleParticipantArgs = {
  amount: Scalars['Money']['input'];
  id: Scalars['ID']['input'];
  note: Scalars['String']['input'];
};


export type MutationSubmitContributionArgs = {
  amount: Scalars['Money']['input'];
  paidAt: Scalars['Date']['input'];
  receiptFileId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateProfileArgs = {
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
};


export type MutationVerifyLoginCodeArgs = {
  code: Scalars['String']['input'];
  email: Scalars['String']['input'];
};

export type OpeningBalanceInput = {
  amount: Scalars['Money']['input'];
  userId: Scalars['ID']['input'];
};

export type OpeningBalancesInput = {
  fundOpeningBalance: Scalars['Money']['input'];
  openingBalances: Array<OpeningBalanceInput>;
  startDate: Scalars['Date']['input'];
};

export type OrderShare = {
  __typename?: 'OrderShare';
  daysPresent: Scalars['Int']['output'];
  order: WaterOrder;
  share: Scalars['Money']['output'];
  totalPersonDays: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  absences: Array<Absence>;
  assistantThread: Array<AssistantMessage>;
  auditLog: Array<AuditEntry>;
  balances: Array<Balance>;
  contributions: Array<Contribution>;
  fund: Fund;
  me?: Maybe<User>;
  participants: Array<User>;
  pendingContributions: Array<Contribution>;
  waterOrders: Array<WaterOrder>;
};


export type QueryAbsencesArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
  type?: InputMaybe<AbsenceType>;
};


export type QueryAuditLogArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryContributionsArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  status?: InputMaybe<ContributionStatus>;
  to?: InputMaybe<Scalars['Date']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryParticipantsArgs = {
  includeInactive?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryWaterOrdersArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
};

export type Receipt = {
  __typename?: 'Receipt';
  extraction?: Maybe<ReceiptExtraction>;
  id: Scalars['ID']['output'];
  url: Scalars['String']['output'];
};

export type ReceiptExtraction = {
  __typename?: 'ReceiptExtraction';
  amount?: Maybe<Scalars['Money']['output']>;
  confidence: Confidence;
  notes: Scalars['String']['output'];
  paidAt?: Maybe<Scalars['Date']['output']>;
  payerHint?: Maybe<Scalars['String']['output']>;
  provider: Scalars['String']['output'];
};

/**
 * Ответ на запрос кода. По §7 он одинаков для разрешённого и неразрешённого
 * адреса, поэтому не содержит ничего, что раскрывало бы состав команды.
 */
export type RequestCodeResult = {
  __typename?: 'RequestCodeResult';
  expiresInSeconds: Scalars['Int']['output'];
  ok: Scalars['Boolean']['output'];
};

export enum Role {
  Admin = 'ADMIN',
  Participant = 'PARTICIPANT'
}

export type Subscription = {
  __typename?: 'Subscription';
  fundUpdated: Fund;
};

export type User = {
  __typename?: 'User';
  absences: Array<Absence>;
  balance: Balance;
  contributions: Array<Contribution>;
  email: Scalars['String']['output'];
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  joinedAt: Scalars['Date']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  leftAt?: Maybe<Scalars['Date']['output']>;
  openingBalance: Scalars['Money']['output'];
  role: Role;
};


export type UserContributionsArgs = {
  status?: InputMaybe<ContributionStatus>;
};

export type WaterOrder = {
  __typename?: 'WaterOrder';
  amount: Scalars['Money']['output'];
  bottlesCount?: Maybe<Scalars['Int']['output']>;
  consumptionPeriodEnd?: Maybe<Scalars['Date']['output']>;
  createdBy: User;
  id: Scalars['ID']['output'];
  note?: Maybe<Scalars['String']['output']>;
  orderedAt: Scalars['Date']['output'];
  receipt?: Maybe<Receipt>;
  shares: Array<OrderShare>;
  supplier?: Maybe<Scalars['String']['output']>;
};

export type WaterOrderInput = {
  amount: Scalars['Money']['input'];
  bottlesCount?: InputMaybe<Scalars['Int']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  orderedAt: Scalars['Date']['input'];
  receiptFileId?: InputMaybe<Scalars['ID']['input']>;
  supplier?: InputMaybe<Scalars['String']['input']>;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Absence: ResolverTypeWrapper<PrismaAbsence>;
  AbsenceType: AbsenceType;
  AssistantMessage: ResolverTypeWrapper<PrismaAssistantMessage>;
  AuditEntry: ResolverTypeWrapper<PrismaAuditEntry>;
  AuthResult: ResolverTypeWrapper<Omit<AuthResult, 'user'> & { user: ResolversTypes['User'] }>;
  Balance: ResolverTypeWrapper<Omit<Balance, 'breakdown' | 'user'> & { breakdown: ResolversTypes['BalanceBreakdown'], user: ResolversTypes['User'] }>;
  BalanceBreakdown: ResolverTypeWrapper<Omit<BalanceBreakdown, 'orderShares'> & { orderShares: Array<ResolversTypes['OrderShare']> }>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Confidence: Confidence;
  Contribution: ResolverTypeWrapper<PrismaContribution>;
  ContributionStatus: ContributionStatus;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Fund: ResolverTypeWrapper<Fund>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  Money: ResolverTypeWrapper<Scalars['Money']['output']>;
  MonthlyStat: ResolverTypeWrapper<MonthlyStat>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  OpeningBalanceInput: OpeningBalanceInput;
  OpeningBalancesInput: OpeningBalancesInput;
  OrderShare: ResolverTypeWrapper<Omit<OrderShare, 'order'> & { order: ResolversTypes['WaterOrder'] }>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Receipt: ResolverTypeWrapper<PrismaReceipt>;
  ReceiptExtraction: ResolverTypeWrapper<ReceiptExtraction>;
  RequestCodeResult: ResolverTypeWrapper<RequestCodeResult>;
  Role: Role;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  User: ResolverTypeWrapper<PrismaUser>;
  WaterOrder: ResolverTypeWrapper<PrismaWaterOrder>;
  WaterOrderInput: WaterOrderInput;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Absence: PrismaAbsence;
  AssistantMessage: PrismaAssistantMessage;
  AuditEntry: PrismaAuditEntry;
  AuthResult: Omit<AuthResult, 'user'> & { user: ResolversParentTypes['User'] };
  Balance: Omit<Balance, 'breakdown' | 'user'> & { breakdown: ResolversParentTypes['BalanceBreakdown'], user: ResolversParentTypes['User'] };
  BalanceBreakdown: Omit<BalanceBreakdown, 'orderShares'> & { orderShares: Array<ResolversParentTypes['OrderShare']> };
  Boolean: Scalars['Boolean']['output'];
  Contribution: PrismaContribution;
  Date: Scalars['Date']['output'];
  DateTime: Scalars['DateTime']['output'];
  Fund: Fund;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  Money: Scalars['Money']['output'];
  MonthlyStat: MonthlyStat;
  Mutation: Record<PropertyKey, never>;
  OpeningBalanceInput: OpeningBalanceInput;
  OpeningBalancesInput: OpeningBalancesInput;
  OrderShare: Omit<OrderShare, 'order'> & { order: ResolversParentTypes['WaterOrder'] };
  Query: Record<PropertyKey, never>;
  Receipt: PrismaReceipt;
  ReceiptExtraction: ReceiptExtraction;
  RequestCodeResult: RequestCodeResult;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  User: PrismaUser;
  WaterOrder: PrismaWaterOrder;
  WaterOrderInput: WaterOrderInput;
};

export type AbsenceResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Absence'] = ResolversParentTypes['Absence']> = {
  endsOn?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  note?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startsOn?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['AbsenceType'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type AssistantMessageResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AssistantMessage'] = ResolversParentTypes['AssistantMessage']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AuditEntryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AuditEntry'] = ResolversParentTypes['AuditEntry']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  actor?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  after?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  before?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  entity?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  entityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type AuthResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AuthResult'] = ResolversParentTypes['AuthResult']> = {
  needsProfile?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type BalanceResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Balance'] = ResolversParentTypes['Balance']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  breakdown?: Resolver<ResolversTypes['BalanceBreakdown'], ParentType, ContextType>;
  owes?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type BalanceBreakdownResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['BalanceBreakdown'] = ResolversParentTypes['BalanceBreakdown']> = {
  contributionsTotal?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  expensesTotal?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  openingBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  orderShares?: Resolver<Array<ResolversTypes['OrderShare']>, ParentType, ContextType>;
  settlementsTotal?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type ContributionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Contribution'] = ResolversParentTypes['Contribution']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  needsAttention?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  paidAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  receipt?: Resolver<Maybe<ResolversTypes['Receipt']>, ParentType, ContextType>;
  reviewComment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  reviewedBy?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ContributionStatus'], ParentType, ContextType>;
  submittedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type FundResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Fund'] = ResolversParentTypes['Fund']> = {
  balance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  balancesSum?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  defaultContribution?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  isConsistent?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  monthlyStats?: Resolver<Array<ResolversTypes['MonthlyStat']>, ParentType, ContextType>;
  openingBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  startDate?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
};

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export interface MoneyScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Money'], any> {
  name: 'Money';
}

export type MonthlyStatResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['MonthlyStat'] = ResolversParentTypes['MonthlyStat']> = {
  contributions?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  endBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  orders?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addAbsence?: Resolver<ResolversTypes['Absence'], ParentType, ContextType, RequireFields<MutationAddAbsenceArgs, 'endsOn' | 'startsOn' | 'type'>>;
  addParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationAddParticipantArgs, 'email' | 'joinedAt'>>;
  askAssistant?: Resolver<ResolversTypes['AssistantMessage'], ParentType, ContextType, RequireFields<MutationAskAssistantArgs, 'question'>>;
  confirmContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationConfirmContributionArgs, 'id'>>;
  createAdjustment?: Resolver<ResolversTypes['Fund'], ParentType, ContextType, RequireFields<MutationCreateAdjustmentArgs, 'amount' | 'comment'>>;
  createWaterOrder?: Resolver<ResolversTypes['WaterOrder'], ParentType, ContextType, RequireFields<MutationCreateWaterOrderArgs, 'input'>>;
  deactivateParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationDeactivateParticipantArgs, 'id' | 'leftAt'>>;
  deleteAbsence?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteAbsenceArgs, 'id'>>;
  extractReceipt?: Resolver<ResolversTypes['ReceiptExtraction'], ParentType, ContextType, RequireFields<MutationExtractReceiptArgs, 'fileId'>>;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  rejectContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationRejectContributionArgs, 'comment' | 'id'>>;
  requestLoginCode?: Resolver<ResolversTypes['RequestCodeResult'], ParentType, ContextType, RequireFields<MutationRequestLoginCodeArgs, 'email'>>;
  setOpeningBalances?: Resolver<ResolversTypes['Fund'], ParentType, ContextType, RequireFields<MutationSetOpeningBalancesArgs, 'input'>>;
  settleParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationSettleParticipantArgs, 'amount' | 'id' | 'note'>>;
  submitContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationSubmitContributionArgs, 'amount' | 'paidAt'>>;
  updateProfile?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateProfileArgs, 'firstName' | 'lastName'>>;
  verifyLoginCode?: Resolver<ResolversTypes['AuthResult'], ParentType, ContextType, RequireFields<MutationVerifyLoginCodeArgs, 'code' | 'email'>>;
};

export type OrderShareResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['OrderShare'] = ResolversParentTypes['OrderShare']> = {
  daysPresent?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  order?: Resolver<ResolversTypes['WaterOrder'], ParentType, ContextType>;
  share?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  totalPersonDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  absences?: Resolver<Array<ResolversTypes['Absence']>, ParentType, ContextType, Partial<QueryAbsencesArgs>>;
  assistantThread?: Resolver<Array<ResolversTypes['AssistantMessage']>, ParentType, ContextType>;
  auditLog?: Resolver<Array<ResolversTypes['AuditEntry']>, ParentType, ContextType, RequireFields<QueryAuditLogArgs, 'limit'>>;
  balances?: Resolver<Array<ResolversTypes['Balance']>, ParentType, ContextType>;
  contributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType, Partial<QueryContributionsArgs>>;
  fund?: Resolver<ResolversTypes['Fund'], ParentType, ContextType>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  participants?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryParticipantsArgs, 'includeInactive'>>;
  pendingContributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType>;
  waterOrders?: Resolver<Array<ResolversTypes['WaterOrder']>, ParentType, ContextType, Partial<QueryWaterOrdersArgs>>;
};

export type ReceiptResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Receipt'] = ResolversParentTypes['Receipt']> = {
  extraction?: Resolver<Maybe<ResolversTypes['ReceiptExtraction']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ReceiptExtractionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ReceiptExtraction'] = ResolversParentTypes['ReceiptExtraction']> = {
  amount?: Resolver<Maybe<ResolversTypes['Money']>, ParentType, ContextType>;
  confidence?: Resolver<ResolversTypes['Confidence'], ParentType, ContextType>;
  notes?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paidAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  payerHint?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type RequestCodeResultResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RequestCodeResult'] = ResolversParentTypes['RequestCodeResult']> = {
  expiresInSeconds?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  ok?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  fundUpdated?: SubscriptionResolver<ResolversTypes['Fund'], "fundUpdated", ParentType, ContextType>;
};

export type UserResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  absences?: Resolver<Array<ResolversTypes['Absence']>, ParentType, ContextType>;
  balance?: Resolver<ResolversTypes['Balance'], ParentType, ContextType>;
  contributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType, Partial<UserContributionsArgs>>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  firstName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  joinedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  lastName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  leftAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  openingBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type WaterOrderResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['WaterOrder'] = ResolversParentTypes['WaterOrder']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  bottlesCount?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  consumptionPeriodEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  createdBy?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  note?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  orderedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  receipt?: Resolver<Maybe<ResolversTypes['Receipt']>, ParentType, ContextType>;
  shares?: Resolver<Array<ResolversTypes['OrderShare']>, ParentType, ContextType>;
  supplier?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Absence?: AbsenceResolvers<ContextType>;
  AssistantMessage?: AssistantMessageResolvers<ContextType>;
  AuditEntry?: AuditEntryResolvers<ContextType>;
  AuthResult?: AuthResultResolvers<ContextType>;
  Balance?: BalanceResolvers<ContextType>;
  BalanceBreakdown?: BalanceBreakdownResolvers<ContextType>;
  Contribution?: ContributionResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  Fund?: FundResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  Money?: GraphQLScalarType;
  MonthlyStat?: MonthlyStatResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  OrderShare?: OrderShareResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Receipt?: ReceiptResolvers<ContextType>;
  ReceiptExtraction?: ReceiptExtractionResolvers<ContextType>;
  RequestCodeResult?: RequestCodeResultResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  WaterOrder?: WaterOrderResolvers<ContextType>;
};

