import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { User as PrismaUser, Department as PrismaDepartment, Contribution as PrismaContribution, WaterOrder as PrismaWaterOrder, Absence as PrismaAbsence, Receipt as PrismaReceipt, AuditEntry as PrismaAuditEntry, AssistantMessage as PrismaAssistantMessage, Announcement as PrismaAnnouncement } from '@/generated/prisma/client';
import type { AnnouncementImageView } from '@/lib/view/announcements';
import type { FundSettings as CalcFundSettings, Balance as CalcBalance, BalanceBreakdown as CalcBalanceBreakdown, OrderShare as CalcOrderShare } from '@/lib/calc/types';
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

/** Отсутствие, внесённое администратором за участника (§6.7). */
export type AbsenceForInput = {
  endsOn: Scalars['Date']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  startsOn: Scalars['Date']['input'];
  type: AbsenceType;
  userId: Scalars['ID']['input'];
};

export enum AbsenceType {
  SickLeave = 'SICK_LEAVE',
  Vacation = 'VACATION'
}

/**
 * Сообщение администратора всем участникам (§6.12): инструкция по пользованию
 * системой или новость про кассу.
 *
 * Событием фонда объявление не является: денег не несёт, в расчёт балансов
 * не входит и в ленту §6.9 не попадает. Отдельный тип именно поэтому.
 */
export type Announcement = {
  __typename?: 'Announcement';
  /** Снято с глаз, но не удалено. */
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  author: User;
  body: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Приложенная картинка; null — её нет. */
  image?: Maybe<AnnouncementImage>;
  /** Опубликовано после последнего захода текущего участника в раздел. */
  isNew: Scalars['Boolean']['output'];
  /** Закреплённое не тонет в списке — так живут инструкции. */
  pinned: Scalars['Boolean']['output'];
  /** null — черновик: виден только администратору. */
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

/**
 * Картинка объявления.
 *
 * Отдаётся ссылкой на приложение, а не на хранилище: байты лежат в базе, и
 * менять это решение не должно означать правку схемы и клиента. Размеры — чтобы
 * страница резервировала место и не дёргалась, когда картинка догрузится.
 */
export type AnnouncementImage = {
  __typename?: 'AnnouncementImage';
  /** Описание для тех, кто картинку не видит. Обязательно (§12). */
  alt: Scalars['String']['output'];
  height: Scalars['Int']['output'];
  mediaType: Scalars['String']['output'];
  url: Scalars['String']['output'];
  width: Scalars['Int']['output'];
};

/**
 * Картинка на загрузку.
 *
 * Байты приходят в base64: у GraphQL нет своего способа передать файл, а заводить
 * второй путь записи ради одного поля значило бы развести проверки прав и формата
 * по двум местам. Тип определяется по сигнатуре файла — `mediaType` лишь сверяется.
 */
export type AnnouncementImageInput = {
  alt: Scalars['String']['input'];
  base64: Scalars['String']['input'];
  mediaType?: InputMaybe<Scalars['String']['input']>;
};

export type AnnouncementInput = {
  body: Scalars['String']['input'];
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** false — сохранить черновиком; повторное false снимает с публикации. */
  published?: InputMaybe<Scalars['Boolean']['input']>;
  title: Scalars['String']['input'];
};

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

/** Результат входа. Сессия уходит в httpOnly-cookie, а не в ответ. */
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
  adjustmentsTotal: Scalars['Money']['output'];
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

/** Взнос, внесённый администратором за участника (§6.7). Подтверждение всё равно требуется. */
export type ContributionForInput = {
  amount: Scalars['Money']['input'];
  paidAt: Scalars['Date']['input'];
  receiptFileId?: InputMaybe<Scalars['ID']['input']>;
  userId: Scalars['ID']['input'];
};

export enum ContributionStatus {
  Confirmed = 'CONFIRMED',
  Pending = 'PENDING',
  /** Внесён администратором за участника (§6.7): в фонде сразу, без подтверждения. */
  Recorded = 'RECORDED',
  Rejected = 'REJECTED'
}

/**
 * Выданные учётные данные — то, что администратор пересылает человеку.
 * Пароль в открытом виде бывает только в этом ответе: в базе лежит отпечаток.
 */
export type Credentials = {
  __typename?: 'Credentials';
  login: Scalars['String']['output'];
  magicLinkExpiresAt: Scalars['DateTime']['output'];
  magicLinkUrl: Scalars['String']['output'];
  password: Scalars['String']['output'];
};

/** Предложение логина и пароля. Ничего не записывает; администратор может их поправить. */
export type CredentialsSuggestion = {
  __typename?: 'CredentialsSuggestion';
  login: Scalars['String']['output'];
  password: Scalars['String']['output'];
};

export type Department = {
  __typename?: 'Department';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

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

export type IssuedCredentials = {
  __typename?: 'IssuedCredentials';
  credentials: Credentials;
  user: User;
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
  addAbsenceFor: Absence;
  addContributionFor: Contribution;
  addParticipant: IssuedCredentials;
  askAssistant: AssistantMessage;
  confirmContribution: Contribution;
  createAdjustment: Fund;
  createAnnouncement: Announcement;
  createWaterOrder: WaterOrder;
  deactivateParticipant: User;
  deleteAbsence: Scalars['Boolean']['output'];
  extractReceipt: ReceiptExtraction;
  /** Новые логин, пароль и ссылка; прежние входы участника отзываются. Только ADMIN. */
  issueCredentials: IssuedCredentials;
  login: AuthResult;
  logout: Scalars['Boolean']['output'];
  /**
   * Отметить раздел просмотренным. Возвращает новый момент отсчёта; null —
   * объявлений нет вовсе, и отмечать нечего.
   */
  markAnnouncementsSeen?: Maybe<Scalars['DateTime']['output']>;
  reactivateParticipant: User;
  rejectContribution: Contribution;
  setAnnouncementArchived: Announcement;
  /** Приложить картинку или убрать её (null). Только ADMIN. */
  setAnnouncementImage: Announcement;
  /** Закрепить или открепить. Закреплённых не больше трёх. Только ADMIN. */
  setAnnouncementPinned: Announcement;
  setOpeningBalances: Fund;
  setParticipantRestriction: User;
  setParticipantRole: User;
  settleParticipant: User;
  submitContribution: Contribution;
  updateAnnouncement: Announcement;
  updateParticipant: User;
  updateProfile: User;
  uploadReceipt: Receipt;
};


export type MutationAddAbsenceArgs = {
  endsOn: Scalars['Date']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  startsOn: Scalars['Date']['input'];
  type: AbsenceType;
};


export type MutationAddAbsenceForArgs = {
  input: AbsenceForInput;
};


export type MutationAddContributionForArgs = {
  input: ContributionForInput;
};


export type MutationAddParticipantArgs = {
  input: NewParticipantInput;
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


export type MutationCreateAnnouncementArgs = {
  input: AnnouncementInput;
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


export type MutationIssueCredentialsArgs = {
  id: Scalars['ID']['input'];
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationLoginArgs = {
  login: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationReactivateParticipantArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRejectContributionArgs = {
  comment: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationSetAnnouncementArchivedArgs = {
  archived: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};


export type MutationSetAnnouncementImageArgs = {
  id: Scalars['ID']['input'];
  image?: InputMaybe<AnnouncementImageInput>;
};


export type MutationSetAnnouncementPinnedArgs = {
  id: Scalars['ID']['input'];
  pinned: Scalars['Boolean']['input'];
};


export type MutationSetOpeningBalancesArgs = {
  input: OpeningBalancesInput;
};


export type MutationSetParticipantRestrictionArgs = {
  id: Scalars['ID']['input'];
  restriction: Restriction;
};


export type MutationSetParticipantRoleArgs = {
  id: Scalars['ID']['input'];
  role: Role;
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


export type MutationUpdateAnnouncementArgs = {
  id: Scalars['ID']['input'];
  input: AnnouncementInput;
};


export type MutationUpdateParticipantArgs = {
  id: Scalars['ID']['input'];
  input: ParticipantProfileInput;
};


export type MutationUpdateProfileArgs = {
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
};


export type MutationUploadReceiptArgs = {
  file: ReceiptFileInput;
};

export type NewParticipantInput = {
  joinedAt: Scalars['Date']['input'];
  login: Scalars['String']['input'];
  openingBalance?: InputMaybe<Scalars['Money']['input']>;
  password: Scalars['String']['input'];
  profile: ParticipantProfileInput;
};

export type OpeningBalanceInput = {
  amount: Scalars['Money']['input'];
  userId: Scalars['ID']['input'];
};

export type OpeningBalancesInput = {
  /**
   * Кнопка «Распределить поровну» (§4.2): доли считает сервер методом наибольших
   * остатков, а в журнал аудита идёт пометка equal-split. Переданные вручную
   * значения при этом игнорируются — иначе непонятно, какое из двух правил главнее.
   */
  equalSplit?: InputMaybe<Scalars['Boolean']['input']>;
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

/**
 * Отдел — либо существующий (departmentId), либо новый по названию
 * (newDepartment); если есть одноимённый, берётся он. Оба пустые — без отдела.
 */
export type ParticipantProfileInput = {
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  middleName?: InputMaybe<Scalars['String']['input']>;
  newDepartment?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  absences: Array<Absence>;
  announcements: Array<Announcement>;
  assistantThread: Array<AssistantMessage>;
  auditLog: Array<AuditEntry>;
  balances: Array<Balance>;
  contributions: Array<Contribution>;
  departments: Array<Department>;
  fund: Fund;
  me?: Maybe<User>;
  participants: Array<User>;
  pendingContributions: Array<Contribution>;
  /** Свободный логин из ФИО и случайный пароль. excludeUserId — не считать занятым свой логин. Только ADMIN. */
  suggestCredentials: CredentialsSuggestion;
  unreadAnnouncements: Scalars['Int']['output'];
  waterOrders: Array<WaterOrder>;
};


export type QueryAbsencesArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
  type?: InputMaybe<AbsenceType>;
};


export type QueryAnnouncementsArgs = {
  includeHidden?: InputMaybe<Scalars['Boolean']['input']>;
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


export type QuerySuggestCredentialsArgs = {
  excludeUserId?: InputMaybe<Scalars['ID']['input']>;
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  middleName?: InputMaybe<Scalars['String']['input']>;
};


export type QueryWaterOrdersArgs = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
};

export type Receipt = {
  __typename?: 'Receipt';
  /** Размер файла в байтах: для подписи кнопки «PDF · 1,2 МБ» */
  byteSize: Scalars['Int']['output'];
  extraction?: Maybe<ReceiptExtraction>;
  id: Scalars['ID']['output'];
  mediaType: Scalars['String']['output'];
  /** /api/receipts/:id — ссылка на приложение, а не на хранилище (§8.4) */
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
 * Файл чека на загрузку (§8.4).
 *
 * Байты приходят в base64: у GraphQL нет своего способа передать файл. Тип
 * определяется по сигнатуре файла — `mediaType` лишь сверяется.
 */
export type ReceiptFileInput = {
  /** У GraphQL нет своего способа передать файл */
  base64: Scalars['String']['input'];
  /** Только сверяется: решает сигнатура файла (§8.4) */
  mediaType?: InputMaybe<Scalars['String']['input']>;
};

/** Ограничение участника (§3): мьют — только просмотр, бан — вход закрыт. */
export enum Restriction {
  Banned = 'BANNED',
  Muted = 'MUTED',
  None = 'NONE'
}

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
  department?: Maybe<Department>;
  email?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  joinedAt: Scalars['Date']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  leftAt?: Maybe<Scalars['Date']['output']>;
  login: Scalars['String']['output'];
  middleName?: Maybe<Scalars['String']['output']>;
  openingBalance: Scalars['Money']['output'];
  restriction: Restriction;
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
  /**
   * Обязателен: поставка без подтверждения оплаты не отмечается (§6.5).
   * Колонка в базе остаётся NULL-разрешающей ради заказов, заведённых раньше.
   */
  receiptFileId: Scalars['ID']['input'];
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
  AbsenceForInput: AbsenceForInput;
  AbsenceType: AbsenceType;
  Announcement: ResolverTypeWrapper<PrismaAnnouncement>;
  AnnouncementImage: ResolverTypeWrapper<AnnouncementImageView>;
  AnnouncementImageInput: AnnouncementImageInput;
  AnnouncementInput: AnnouncementInput;
  AssistantMessage: ResolverTypeWrapper<PrismaAssistantMessage>;
  AuditEntry: ResolverTypeWrapper<PrismaAuditEntry>;
  AuthResult: ResolverTypeWrapper<Omit<AuthResult, 'user'> & { user: ResolversTypes['User'] }>;
  Balance: ResolverTypeWrapper<CalcBalance>;
  BalanceBreakdown: ResolverTypeWrapper<CalcBalanceBreakdown>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Confidence: Confidence;
  Contribution: ResolverTypeWrapper<PrismaContribution>;
  ContributionForInput: ContributionForInput;
  ContributionStatus: ContributionStatus;
  Credentials: ResolverTypeWrapper<Credentials>;
  CredentialsSuggestion: ResolverTypeWrapper<CredentialsSuggestion>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Department: ResolverTypeWrapper<PrismaDepartment>;
  Fund: ResolverTypeWrapper<CalcFundSettings>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  IssuedCredentials: ResolverTypeWrapper<Omit<IssuedCredentials, 'user'> & { user: ResolversTypes['User'] }>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  Money: ResolverTypeWrapper<Scalars['Money']['output']>;
  MonthlyStat: ResolverTypeWrapper<MonthlyStat>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  NewParticipantInput: NewParticipantInput;
  OpeningBalanceInput: OpeningBalanceInput;
  OpeningBalancesInput: OpeningBalancesInput;
  OrderShare: ResolverTypeWrapper<CalcOrderShare>;
  ParticipantProfileInput: ParticipantProfileInput;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Receipt: ResolverTypeWrapper<PrismaReceipt>;
  ReceiptExtraction: ResolverTypeWrapper<ReceiptExtraction>;
  ReceiptFileInput: ReceiptFileInput;
  Restriction: Restriction;
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
  AbsenceForInput: AbsenceForInput;
  Announcement: PrismaAnnouncement;
  AnnouncementImage: AnnouncementImageView;
  AnnouncementImageInput: AnnouncementImageInput;
  AnnouncementInput: AnnouncementInput;
  AssistantMessage: PrismaAssistantMessage;
  AuditEntry: PrismaAuditEntry;
  AuthResult: Omit<AuthResult, 'user'> & { user: ResolversParentTypes['User'] };
  Balance: CalcBalance;
  BalanceBreakdown: CalcBalanceBreakdown;
  Boolean: Scalars['Boolean']['output'];
  Contribution: PrismaContribution;
  ContributionForInput: ContributionForInput;
  Credentials: Credentials;
  CredentialsSuggestion: CredentialsSuggestion;
  Date: Scalars['Date']['output'];
  DateTime: Scalars['DateTime']['output'];
  Department: PrismaDepartment;
  Fund: CalcFundSettings;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  IssuedCredentials: Omit<IssuedCredentials, 'user'> & { user: ResolversParentTypes['User'] };
  JSON: Scalars['JSON']['output'];
  Money: Scalars['Money']['output'];
  MonthlyStat: MonthlyStat;
  Mutation: Record<PropertyKey, never>;
  NewParticipantInput: NewParticipantInput;
  OpeningBalanceInput: OpeningBalanceInput;
  OpeningBalancesInput: OpeningBalancesInput;
  OrderShare: CalcOrderShare;
  ParticipantProfileInput: ParticipantProfileInput;
  Query: Record<PropertyKey, never>;
  Receipt: PrismaReceipt;
  ReceiptExtraction: ReceiptExtraction;
  ReceiptFileInput: ReceiptFileInput;
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

export type AnnouncementResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Announcement'] = ResolversParentTypes['Announcement']> = {
  archivedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  author?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  body?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  image?: Resolver<Maybe<ResolversTypes['AnnouncementImage']>, ParentType, ContextType>;
  isNew?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  pinned?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  publishedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type AnnouncementImageResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AnnouncementImage'] = ResolversParentTypes['AnnouncementImage']> = {
  alt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  height?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  mediaType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  width?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  adjustmentsTotal?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
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

export type CredentialsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Credentials'] = ResolversParentTypes['Credentials']> = {
  login?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  magicLinkExpiresAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  magicLinkUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  password?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CredentialsSuggestionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CredentialsSuggestion'] = ResolversParentTypes['CredentialsSuggestion']> = {
  login?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  password?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DepartmentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Department'] = ResolversParentTypes['Department']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type FundResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Fund'] = ResolversParentTypes['Fund']> = {
  balance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  balancesSum?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  defaultContribution?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  isConsistent?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  monthlyStats?: Resolver<Array<ResolversTypes['MonthlyStat']>, ParentType, ContextType>;
  openingBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  startDate?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
};

export type IssuedCredentialsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['IssuedCredentials'] = ResolversParentTypes['IssuedCredentials']> = {
  credentials?: Resolver<ResolversTypes['Credentials'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
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
  addAbsenceFor?: Resolver<ResolversTypes['Absence'], ParentType, ContextType, RequireFields<MutationAddAbsenceForArgs, 'input'>>;
  addContributionFor?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationAddContributionForArgs, 'input'>>;
  addParticipant?: Resolver<ResolversTypes['IssuedCredentials'], ParentType, ContextType, RequireFields<MutationAddParticipantArgs, 'input'>>;
  askAssistant?: Resolver<ResolversTypes['AssistantMessage'], ParentType, ContextType, RequireFields<MutationAskAssistantArgs, 'question'>>;
  confirmContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationConfirmContributionArgs, 'id'>>;
  createAdjustment?: Resolver<ResolversTypes['Fund'], ParentType, ContextType, RequireFields<MutationCreateAdjustmentArgs, 'amount' | 'comment'>>;
  createAnnouncement?: Resolver<ResolversTypes['Announcement'], ParentType, ContextType, RequireFields<MutationCreateAnnouncementArgs, 'input'>>;
  createWaterOrder?: Resolver<ResolversTypes['WaterOrder'], ParentType, ContextType, RequireFields<MutationCreateWaterOrderArgs, 'input'>>;
  deactivateParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationDeactivateParticipantArgs, 'id' | 'leftAt'>>;
  deleteAbsence?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteAbsenceArgs, 'id'>>;
  extractReceipt?: Resolver<ResolversTypes['ReceiptExtraction'], ParentType, ContextType, RequireFields<MutationExtractReceiptArgs, 'fileId'>>;
  issueCredentials?: Resolver<ResolversTypes['IssuedCredentials'], ParentType, ContextType, RequireFields<MutationIssueCredentialsArgs, 'id' | 'login' | 'password'>>;
  login?: Resolver<ResolversTypes['AuthResult'], ParentType, ContextType, RequireFields<MutationLoginArgs, 'login' | 'password'>>;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  markAnnouncementsSeen?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  reactivateParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationReactivateParticipantArgs, 'id'>>;
  rejectContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationRejectContributionArgs, 'comment' | 'id'>>;
  setAnnouncementArchived?: Resolver<ResolversTypes['Announcement'], ParentType, ContextType, RequireFields<MutationSetAnnouncementArchivedArgs, 'archived' | 'id'>>;
  setAnnouncementImage?: Resolver<ResolversTypes['Announcement'], ParentType, ContextType, RequireFields<MutationSetAnnouncementImageArgs, 'id'>>;
  setAnnouncementPinned?: Resolver<ResolversTypes['Announcement'], ParentType, ContextType, RequireFields<MutationSetAnnouncementPinnedArgs, 'id' | 'pinned'>>;
  setOpeningBalances?: Resolver<ResolversTypes['Fund'], ParentType, ContextType, RequireFields<MutationSetOpeningBalancesArgs, 'input'>>;
  setParticipantRestriction?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationSetParticipantRestrictionArgs, 'id' | 'restriction'>>;
  setParticipantRole?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationSetParticipantRoleArgs, 'id' | 'role'>>;
  settleParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationSettleParticipantArgs, 'amount' | 'id' | 'note'>>;
  submitContribution?: Resolver<ResolversTypes['Contribution'], ParentType, ContextType, RequireFields<MutationSubmitContributionArgs, 'amount' | 'paidAt'>>;
  updateAnnouncement?: Resolver<ResolversTypes['Announcement'], ParentType, ContextType, RequireFields<MutationUpdateAnnouncementArgs, 'id' | 'input'>>;
  updateParticipant?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateParticipantArgs, 'id' | 'input'>>;
  updateProfile?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateProfileArgs, 'firstName' | 'lastName'>>;
  uploadReceipt?: Resolver<ResolversTypes['Receipt'], ParentType, ContextType, RequireFields<MutationUploadReceiptArgs, 'file'>>;
};

export type OrderShareResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['OrderShare'] = ResolversParentTypes['OrderShare']> = {
  daysPresent?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  order?: Resolver<ResolversTypes['WaterOrder'], ParentType, ContextType>;
  share?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  totalPersonDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  absences?: Resolver<Array<ResolversTypes['Absence']>, ParentType, ContextType, Partial<QueryAbsencesArgs>>;
  announcements?: Resolver<Array<ResolversTypes['Announcement']>, ParentType, ContextType, RequireFields<QueryAnnouncementsArgs, 'includeHidden'>>;
  assistantThread?: Resolver<Array<ResolversTypes['AssistantMessage']>, ParentType, ContextType>;
  auditLog?: Resolver<Array<ResolversTypes['AuditEntry']>, ParentType, ContextType, RequireFields<QueryAuditLogArgs, 'limit'>>;
  balances?: Resolver<Array<ResolversTypes['Balance']>, ParentType, ContextType>;
  contributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType, Partial<QueryContributionsArgs>>;
  departments?: Resolver<Array<ResolversTypes['Department']>, ParentType, ContextType>;
  fund?: Resolver<ResolversTypes['Fund'], ParentType, ContextType>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  participants?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryParticipantsArgs, 'includeInactive'>>;
  pendingContributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType>;
  suggestCredentials?: Resolver<ResolversTypes['CredentialsSuggestion'], ParentType, ContextType, RequireFields<QuerySuggestCredentialsArgs, 'firstName' | 'lastName'>>;
  unreadAnnouncements?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  waterOrders?: Resolver<Array<ResolversTypes['WaterOrder']>, ParentType, ContextType, Partial<QueryWaterOrdersArgs>>;
};

export type ReceiptResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Receipt'] = ResolversParentTypes['Receipt']> = {
  byteSize?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  extraction?: Resolver<Maybe<ResolversTypes['ReceiptExtraction']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  mediaType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
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

export type SubscriptionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  fundUpdated?: SubscriptionResolver<ResolversTypes['Fund'], "fundUpdated", ParentType, ContextType>;
};

export type UserResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  absences?: Resolver<Array<ResolversTypes['Absence']>, ParentType, ContextType>;
  balance?: Resolver<ResolversTypes['Balance'], ParentType, ContextType>;
  contributions?: Resolver<Array<ResolversTypes['Contribution']>, ParentType, ContextType, Partial<UserContributionsArgs>>;
  department?: Resolver<Maybe<ResolversTypes['Department']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  firstName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  joinedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  lastName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  leftAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  login?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  middleName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  openingBalance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  restriction?: Resolver<ResolversTypes['Restriction'], ParentType, ContextType>;
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
  Announcement?: AnnouncementResolvers<ContextType>;
  AnnouncementImage?: AnnouncementImageResolvers<ContextType>;
  AssistantMessage?: AssistantMessageResolvers<ContextType>;
  AuditEntry?: AuditEntryResolvers<ContextType>;
  AuthResult?: AuthResultResolvers<ContextType>;
  Balance?: BalanceResolvers<ContextType>;
  BalanceBreakdown?: BalanceBreakdownResolvers<ContextType>;
  Contribution?: ContributionResolvers<ContextType>;
  Credentials?: CredentialsResolvers<ContextType>;
  CredentialsSuggestion?: CredentialsSuggestionResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  Department?: DepartmentResolvers<ContextType>;
  Fund?: FundResolvers<ContextType>;
  IssuedCredentials?: IssuedCredentialsResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  Money?: GraphQLScalarType;
  MonthlyStat?: MonthlyStatResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  OrderShare?: OrderShareResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Receipt?: ReceiptResolvers<ContextType>;
  ReceiptExtraction?: ReceiptExtractionResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  WaterOrder?: WaterOrderResolvers<ContextType>;
};

