/**
 * The invariant of SPEC §5 and rule 1 of CLAUDE.md:
 *
 * ```
 * Σ_i Баланс(i)  ==  Остаток фонда
 * ```
 *
 * Exact, in kopecks, with no tolerance. A discrepancy is always a bug in the
 * code, never in the data — hence `assertInvariant`, which is meant to be called
 * on every recalculation (§5, runtime check) and after every operation of the
 * generative test.
 */

import { sumBy, type Kopecks } from '../money';
import { computeBalances, sumOpeningBalances } from './balances';
import type { CalcInput, CalcResult, InvariantReport, Participant } from './types';

/** Compares the sum of balances with the fund balance. `difference` is zero when consistent. */
export function checkInvariant(result: CalcResult): InvariantReport {
  const balancesSum = sumBy(result.balances, (balance) => balance.amount);
  const difference = balancesSum - result.fundBalance;

  return {
    fundBalance: result.fundBalance,
    balancesSum,
    difference,
    isConsistent: difference === 0,
  };
}

/** Recalculates from raw input and checks the invariant in one step. */
export function checkInvariantFor(input: CalcInput): InvariantReport {
  return checkInvariant(computeBalances(input));
}

export class InvariantViolationError extends Error {
  readonly report: InvariantReport;

  constructor(report: InvariantReport) {
    super(
      `Invariant violated: Σ balances = ${report.balancesSum} kopecks, fund = ${report.fundBalance} kopecks, ` +
        `difference = ${report.difference} kopecks`,
    );
    this.name = 'InvariantViolationError';
    this.report = report;
  }
}

/** Throws `InvariantViolationError` unless the sums match exactly. */
export function assertInvariant(result: CalcResult): InvariantReport {
  const report = checkInvariant(result);
  if (!report.isConsistent) {
    throw new InvariantViolationError(report);
  }
  return report;
}

/**
 * The same invariant applied to the starting point (§4.2): a migration must not
 * be saved unless `Σ openingBalance(i) == fundOpeningBalance`. The form shows
 * `difference` and refuses to continue while it is non-zero.
 */
export function checkOpeningInvariant(
  participants: readonly Participant[],
  fundOpeningBalance: Kopecks,
): InvariantReport {
  const balancesSum = sumOpeningBalances(participants);
  const difference = balancesSum - fundOpeningBalance;

  return {
    fundBalance: fundOpeningBalance,
    balancesSum,
    difference,
    isConsistent: difference === 0,
  };
}

/**
 * Verifies rule 3 of CLAUDE.md on an already-computed result: the shares of every
 * order must sum to exactly its amount. Cheap enough to run alongside the main
 * invariant check.
 */
export function checkOrderShares(result: CalcResult): { orderId: string; expected: Kopecks; actual: Kopecks }[] {
  const mismatches: { orderId: string; expected: Kopecks; actual: Kopecks }[] = [];
  for (const period of result.orderPeriods) {
    const actual = sumBy(period.shares, (share) => share.share);
    if (actual !== period.amount) {
      mismatches.push({ orderId: period.orderId, expected: period.amount, actual });
    }
  }
  return mismatches;
}
