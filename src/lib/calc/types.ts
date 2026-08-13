/**
 * Input and output types of the calculation core (SPEC §4).
 *
 * These types are deliberately independent of Prisma, GraphQL and the database:
 * the core is a pure function from plain data to plain data (SPEC §13, rule 5 of
 * CLAUDE.md). The persistence layer maps rows onto these shapes.
 */

import type { Kopecks } from '../money';

/** Calendar date in `YYYY-MM-DD`. Granularity of the whole model is one day (§4.1). */
export type IsoDate = string;

/** Half-open date interval `[from, to)` — the notation used throughout §4.1. */
export type DateRange = {
  /** Inclusive lower bound. */
  from: IsoDate;
  /** Exclusive upper bound. */
  to: IsoDate;
};

export type AbsenceType = 'VACATION' | 'SICK_LEAVE';

/**
 * A participant with a membership window `[joinedAt, leftAt)` and an opening
 * balance carried over from the Excel migration (§4.2).
 */
export type Participant = {
  id: string;
  /** First day of membership, inclusive. */
  joinedAt: IsoDate;
  /** First day *after* membership; `null` while the participant is still active. */
  leftAt: IsoDate | null;
  /** Personal balance at `migrationDate` (§4.2). Zero when there was no migration. */
  openingBalance: Kopecks;
};

/**
 * A period out of the office. Both ends are **inclusive** — that is how the dates
 * are entered and how `absences.starts_on / ends_on` are stored (§11).
 * `type` is kept for the calendar only; it never enters the formula (§4.1).
 */
export type Absence = {
  id: string;
  userId: string;
  type: AbsenceType;
  startsOn: IsoDate;
  endsOn: IsoDate;
};

/** A water purchase — money leaving the fund (§2.3, §4.3). */
export type WaterOrder = {
  id: string;
  /** Strictly positive, in kopecks. */
  amount: Kopecks;
  orderedAt: IsoDate;
  /** Pre-migration record kept for display only; excluded from every total (§4.2). */
  historical?: boolean;
};

export type ContributionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/** A participant's payment into the fund. Affects balances only once CONFIRMED (rule 6). */
export type Contribution = {
  id: string;
  userId: string;
  /** Strictly positive, in kopecks. */
  amount: Kopecks;
  paidAt: IsoDate;
  status: ContributionStatus;
  historical?: boolean;
};

/**
 * A manually entered fund transaction: a payout to a leaving participant or an
 * administrator's correction (§2.3).
 *
 * Only these two kinds are accepted here. `OPENING`, `CONTRIBUTION` and `ORDER`
 * rows of `fund_transactions` are *derived* from `FundSettings`, `Contribution`
 * and `WaterOrder`; feeding them in as well would double-count them.
 */
export type ManualTransactionType = 'SETTLEMENT' | 'ADJUSTMENT';

export type FundTransaction = {
  id: string;
  type: ManualTransactionType;
  /** Signed, per §2.3 and §11: `SETTLEMENT` is negative, `ADJUSTMENT` is either sign. */
  amount: Kopecks;
  /**
   * Participant the transaction belongs to. Required for `SETTLEMENT`.
   * An `ADJUSTMENT` with `null` is a fund-level correction and is spread across
   * the participants active on `occurredOn` (see `balances.ts`), because a change
   * to the fund that touches nobody's balance would break the invariant of §5.
   */
  userId: string | null;
  occurredOn: IsoDate;
  comment?: string;
};

/** Singleton fund configuration (§11 `fund_settings`). */
export type FundSettings = {
  /** Fund balance recorded at `migrationDate` (§4.2). */
  openingBalance: Kopecks;
  /**
   * Date the Excel state was frozen on. Everything strictly before it is already
   * folded into the opening balances and is excluded from the calculation (§4.2).
   * `null` — migration has not been performed, nothing is excluded.
   */
  migrationDate: IsoDate | null;
  /** Suggested contribution size, presentation only. */
  defaultContribution: Kopecks;
};

/** Everything the core needs to produce balances. Pure data, no clock inside (§4.4). */
export type CalcInput = {
  participants: readonly Participant[];
  absences: readonly Absence[];
  orders: readonly WaterOrder[];
  contributions: readonly Contribution[];
  transactions?: readonly FundTransaction[];
  fund: FundSettings;
  /**
   * "Today" — the end of the open consumption period of the last order (§4.3).
   * Passed in rather than read from the clock so the core stays pure and testable.
   */
  asOf: IsoDate;
};

// ─── Output ──────────────────────────────────────────────────────────────────

/** One participant's slice of one order (§4.4, GraphQL `OrderShare`). */
export type OrderShare = {
  orderId: string;
  userId: string;
  /** Days the participant was present within the order's consumption period. */
  daysPresent: number;
  /** `D_k` — person-days of every participant in that period. */
  totalPersonDays: number;
  /** The participant's share of `C_k`, in kopecks. */
  share: Kopecks;
};

/** The consumption period of an order, `[from, to)` (§4.3). */
export type OrderPeriod = {
  orderId: string;
  orderedAt: IsoDate;
  amount: Kopecks;
  period: DateRange;
  /** `true` for the last order, whose period is still running. */
  isOpen: boolean;
  /** `true` when `D_k = 0` and the cost was split equally (§4.4 degenerate case). */
  isDegenerate: boolean;
  totalPersonDays: number;
  shares: readonly OrderShare[];
};

/** Line-by-line explanation behind one balance (GraphQL `BalanceBreakdown`, §6.4). */
export type BalanceBreakdown = {
  openingBalance: Kopecks;
  contributionsTotal: Kopecks;
  /** `Расход(i)` — the sum of the participant's order shares. Positive magnitude. */
  expensesTotal: Kopecks;
  /** Signed sum of `SETTLEMENT` rows for the participant (negative when paid out). */
  settlementsTotal: Kopecks;
  /** Signed sum of `ADJUSTMENT` rows, including this participant's part of fund-level ones. */
  adjustmentsTotal: Kopecks;
  orderShares: readonly OrderShare[];
};

/** `Баланс(i)` and its derivation (§4.5, GraphQL `Balance`). */
export type Balance = {
  userId: string;
  /** Negative → the participant owes money. */
  amount: Kopecks;
  owes: boolean;
  breakdown: BalanceBreakdown;
};

/** Full result of a recalculation. */
export type CalcResult = {
  /** Remaining money in the fund (§4.5). */
  fundBalance: Kopecks;
  balances: readonly Balance[];
  /** Per-order distribution, in chronological order. */
  orderPeriods: readonly OrderPeriod[];
};

/** Outcome of the invariant check of §5. */
export type InvariantReport = {
  fundBalance: Kopecks;
  balancesSum: Kopecks;
  /** `balancesSum − fundBalance`; zero when consistent. */
  difference: Kopecks;
  isConsistent: boolean;
};
