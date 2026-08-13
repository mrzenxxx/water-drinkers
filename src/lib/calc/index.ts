/**
 * Public surface of the calculation core (SPEC §4–§5).
 *
 * Everything exported here is a pure function of its arguments: no database, no
 * network, no global state, no clock. "Today" is always passed in as `asOf`.
 */

export type {
  Absence,
  AbsenceType,
  Balance,
  BalanceBreakdown,
  CalcInput,
  CalcResult,
  Contribution,
  ContributionStatus,
  DateRange,
  FundSettings,
  FundTransaction,
  InvariantReport,
  IsoDate,
  ManualTransactionType,
  OrderPeriod,
  OrderShare,
  Participant,
  WaterOrder,
} from './types';

export {
  addDays,
  compareDates,
  dayCount,
  daysPresent,
  fromEpochDay,
  isIsoDate,
  isMemberOn,
  maxDate,
  minDate,
  overlapsRange,
  parseIsoDate,
  toEpochDay,
} from './dates';

export type { ConsumptionPeriod, WeightedEntry } from './shares';

export {
  allocateByLargestRemainder,
  allocateEqually,
  buildConsumptionPeriods,
  distributeOrder,
  distributeOrders,
  periodLength,
} from './shares';

export {
  computeBalances,
  computeFundBalance,
  countableContributions,
  countableOrders,
  countableTransactions,
  splitOpeningBalanceEqually,
  sumOpeningBalances,
} from './balances';

export {
  InvariantViolationError,
  assertInvariant,
  checkInvariant,
  checkInvariantFor,
  checkOpeningInvariant,
  checkOrderShares,
} from './invariant';
