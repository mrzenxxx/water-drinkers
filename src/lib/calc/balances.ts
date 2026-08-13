/**
 * Final balance and fund formulas (SPEC §4.5), on top of the opening balances
 * set by the administrator (§4.2).
 *
 * ```
 * Баланс(i) = openingBalance(i) + Взносы(i) − Расход(i) + Выплаты(i)
 * Фонд      = fundOpeningBalance + Σ взносы − Σ заказы ± Σ выплаты и корректировки
 * ```
 *
 * Both sides are computed here from the *same* filtered data, which is what makes
 * the invariant of §5 a property of the code rather than a coincidence.
 *
 * Everything is pure: no database, no network, no clock — "today" arrives as
 * `input.asOf`.
 */

import { assertKopecks, sumBy, type Kopecks } from '../money';
import { compareDates, isMemberOn } from './dates';
import { allocateEqually, distributeOrders } from './shares';
import type {
  Balance,
  BalanceBreakdown,
  CalcInput,
  CalcResult,
  Contribution,
  FundSettings,
  FundTransaction,
  IsoDate,
  OrderPeriod,
  OrderShare,
  Participant,
  WaterOrder,
} from './types';

/** `true` when the record is on or after the start date and not marked historical (§4.2). */
function isCountable(date: IsoDate, historical: boolean | undefined, startDate: IsoDate | null): boolean {
  if (historical === true) return false;
  if (startDate === null) return true;
  return compareDates(date, startDate) >= 0;
}

/** Orders that move money on or after the start of accounting (§4.2). */
export function countableOrders(orders: readonly WaterOrder[], fund: FundSettings): WaterOrder[] {
  return orders.filter((order) => isCountable(order.orderedAt, order.historical, fund.startDate));
}

/**
 * Contributions that move money: confirmed by an administrator (rule 6 of
 * CLAUDE.md, §4.5) and on or after the start of accounting.
 */
export function countableContributions(
  contributions: readonly Contribution[],
  fund: FundSettings,
): Contribution[] {
  return contributions.filter(
    (contribution) =>
      contribution.status === 'CONFIRMED' &&
      isCountable(contribution.paidAt, contribution.historical, fund.startDate),
  );
}

/** Settlements and adjustments on or after the start of accounting. */
export function countableTransactions(
  transactions: readonly FundTransaction[],
  fund: FundSettings,
): FundTransaction[] {
  return transactions.filter((transaction) =>
    isCountable(transaction.occurredOn, undefined, fund.startDate),
  );
}

function validateInput(input: CalcInput): void {
  const seen = new Set<string>();
  for (const participant of input.participants) {
    if (seen.has(participant.id)) {
      throw new RangeError(`duplicate participant id "${participant.id}"`);
    }
    seen.add(participant.id);
    assertKopecks(participant.openingBalance, `opening balance of ${participant.id}`);
  }

  for (const order of input.orders) {
    assertKopecks(order.amount, `amount of order ${order.id}`);
    if (order.amount <= 0) {
      throw new RangeError(`order ${order.id} must have a positive amount, got ${order.amount}`);
    }
  }

  for (const contribution of input.contributions) {
    assertKopecks(contribution.amount, `amount of contribution ${contribution.id}`);
    if (contribution.amount <= 0) {
      throw new RangeError(`contribution ${contribution.id} must have a positive amount, got ${contribution.amount}`);
    }
    if (!seen.has(contribution.userId)) {
      throw new RangeError(`contribution ${contribution.id} references unknown participant "${contribution.userId}"`);
    }
  }

  for (const absence of input.absences) {
    if (!seen.has(absence.userId)) {
      throw new RangeError(`absence ${absence.id} references unknown participant "${absence.userId}"`);
    }
  }

  for (const transaction of input.transactions ?? []) {
    assertKopecks(transaction.amount, `amount of transaction ${transaction.id}`);
    if (transaction.type === 'SETTLEMENT') {
      if (transaction.userId === null) {
        throw new RangeError(`settlement ${transaction.id} must belong to a participant`);
      }
      if (transaction.amount > 0) {
        throw new RangeError(
          `settlement ${transaction.id} must be negative — money leaves the fund (§2.3), got ${transaction.amount}`,
        );
      }
    }
    if (transaction.userId !== null && !seen.has(transaction.userId)) {
      throw new RangeError(`transaction ${transaction.id} references unknown participant "${transaction.userId}"`);
    }
  }

  assertKopecks(input.fund.openingBalance, 'fund opening balance');
}

/**
 * Recipients of a fund-level `ADJUSTMENT` (one with no `userId`).
 *
 * The spec allows such a correction (§10.2 `createAdjustment(userId: ID, …)`,
 * nullable `user_id` in §11) but does not say whose balance it moves. Leaving it
 * on nobody would change the fund without changing any balance and break the
 * invariant of §5, which rule 1 does not permit. It is therefore spread equally
 * over the participants active on its date — the same "split equally" rule §4.2
 * and §4.4 already use elsewhere.
 */
function fundLevelRecipients(participants: readonly Participant[], transaction: FundTransaction): Participant[] {
  const active = participants.filter((participant) => isMemberOn(participant, transaction.occurredOn));
  if (active.length > 0) return active;
  if (participants.length === 0) {
    throw new RangeError(
      `adjustment ${transaction.id} of ${transaction.amount} kopecks cannot be attributed: there are no participants`,
    );
  }
  return [...participants];
}

/** Remaining money in the fund (§4.5), from the same filtered data as the balances. */
export function computeFundBalance(input: CalcInput): Kopecks {
  const contributionsTotal = sumBy(countableContributions(input.contributions, input.fund), (c) => c.amount);
  const ordersTotal = sumBy(countableOrders(input.orders, input.fund), (o) => o.amount);
  const transactionsTotal = sumBy(countableTransactions(input.transactions ?? [], input.fund), (t) => t.amount);

  return input.fund.openingBalance + contributionsTotal - ordersTotal + transactionsTotal;
}

/** Sum of the participants' opening balances — must equal `fund.openingBalance` (§4.2). */
export function sumOpeningBalances(participants: readonly Participant[]): Kopecks {
  return sumBy(participants, (participant) => participant.openingBalance);
}

/**
 * The "split equally" button of the opening-balances form (§4.2): distributes the fund's
 * opening balance across participants by the largest remainder method, so the
 * opening invariant `Σ openingBalance(i) == fundOpeningBalance` holds by
 * construction. A deliberate loss of precision, logged as `equal-split`.
 */
export function splitOpeningBalanceEqually(
  fundOpeningBalance: Kopecks,
  participantIds: readonly string[],
): Map<string, Kopecks> {
  return allocateEqually(fundOpeningBalance, participantIds);
}

/**
 * Full recalculation: fund balance, every participant's balance and the per-order
 * distribution behind them (§4.4–§4.5).
 */
export function computeBalances(input: CalcInput): CalcResult {
  validateInput(input);

  const orders = countableOrders(input.orders, input.fund);
  const contributions = countableContributions(input.contributions, input.fund);
  const transactions = countableTransactions(input.transactions ?? [], input.fund);

  const orderPeriods: OrderPeriod[] = distributeOrders(orders, input.participants, input.absences, input.asOf);

  const expenses = new Map<string, Kopecks>();
  const sharesByUser = new Map<string, OrderShare[]>();
  for (const period of orderPeriods) {
    for (const share of period.shares) {
      expenses.set(share.userId, (expenses.get(share.userId) ?? 0) + share.share);
      const list = sharesByUser.get(share.userId);
      if (list) list.push(share);
      else sharesByUser.set(share.userId, [share]);
    }
  }

  const contributionTotals = new Map<string, Kopecks>();
  for (const contribution of contributions) {
    contributionTotals.set(
      contribution.userId,
      (contributionTotals.get(contribution.userId) ?? 0) + contribution.amount,
    );
  }

  const settlementTotals = new Map<string, Kopecks>();
  const adjustmentTotals = new Map<string, Kopecks>();
  for (const transaction of transactions) {
    const target = transaction.type === 'SETTLEMENT' ? settlementTotals : adjustmentTotals;
    if (transaction.userId !== null) {
      target.set(transaction.userId, (target.get(transaction.userId) ?? 0) + transaction.amount);
      continue;
    }
    const spread = allocateEqually(
      transaction.amount,
      fundLevelRecipients(input.participants, transaction).map((participant) => participant.id),
    );
    for (const [userId, amount] of spread) {
      target.set(userId, (target.get(userId) ?? 0) + amount);
    }
  }

  const balances: Balance[] = input.participants.map((participant) => {
    const breakdown: BalanceBreakdown = {
      openingBalance: participant.openingBalance,
      contributionsTotal: contributionTotals.get(participant.id) ?? 0,
      expensesTotal: expenses.get(participant.id) ?? 0,
      settlementsTotal: settlementTotals.get(participant.id) ?? 0,
      adjustmentsTotal: adjustmentTotals.get(participant.id) ?? 0,
      orderShares: sharesByUser.get(participant.id) ?? [],
    };

    const amount =
      breakdown.openingBalance +
      breakdown.contributionsTotal -
      breakdown.expensesTotal +
      breakdown.settlementsTotal +
      breakdown.adjustmentsTotal;

    assertKopecks(amount, `balance of ${participant.id}`);

    return { userId: participant.id, amount, owes: amount < 0, breakdown };
  });

  return {
    fundBalance: computeFundBalance(input),
    balances,
    orderPeriods,
  };
}
