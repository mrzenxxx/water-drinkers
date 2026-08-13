/**
 * Splitting an order across participants (SPEC §4.3–§4.4) and rounding by the
 * largest remainder method (§4.6).
 *
 * The one hard guarantee of this module: **the shares always sum to exactly the
 * amount being distributed**, for any weights and any amount. That is rule 3 of
 * CLAUDE.md, and the invariant of §5 rests on it.
 *
 * Intermediate products are computed in `BigInt` so that `amount × weight` is
 * exact regardless of magnitude; the results come back as safe integers.
 */

import { assertKopecks, type Kopecks } from '../money';
import { compareDates, dayCount, daysPresent, isMemberOn, maxDate, overlapsRange } from './dates';
import type { Absence, DateRange, IsoDate, OrderPeriod, OrderShare, Participant, WaterOrder } from './types';

/** One recipient of an allocation and its non-negative integer weight. */
export type WeightedEntry = {
  id: string;
  weight: number;
};

/** Deterministic ordering for ties: the smaller `id` wins (§4.6). */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Distributes `total` in proportion to the weights, using the **largest remainder
 * method** (§4.6):
 *
 * 1. the exact share is the rational `total × weight_i / Σweight`;
 * 2. each recipient takes the integer part in kopecks;
 * 3. the undistributed remainder — at most `n − 1` kopecks — goes one kopeck at a
 *    time to the recipients with the largest fractional part; ties are broken by
 *    ascending `id`, so the result is fully deterministic.
 *
 * `Σ result = total` exactly. Negative totals are supported (the magnitude is
 * distributed and the signs flipped), which is what fund-level `ADJUSTMENT`
 * corrections need.
 *
 * Recipients with weight `0` never receive a kopeck: the leftover is strictly
 * smaller than the number of recipients with a non-zero remainder, and those sort
 * ahead of everybody else.
 */
export function allocateByLargestRemainder(
  total: Kopecks,
  entries: readonly WeightedEntry[],
): Map<string, Kopecks> {
  assertKopecks(total, 'total');

  const result = new Map<string, Kopecks>();
  let totalWeight = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.weight) || entry.weight < 0) {
      throw new RangeError(`weight of "${entry.id}" must be a non-negative integer, got ${String(entry.weight)}`);
    }
    if (result.has(entry.id)) {
      throw new RangeError(`duplicate recipient "${entry.id}" in allocation`);
    }
    result.set(entry.id, 0);
    totalWeight += entry.weight;
  }

  if (total === 0) return result;
  if (entries.length === 0) {
    throw new RangeError(`cannot distribute ${total} kopecks: no recipients`);
  }
  if (totalWeight === 0) {
    throw new RangeError(`cannot distribute ${total} kopecks: total weight is zero`);
  }

  const sign = total < 0 ? -1 : 1;
  const magnitude = BigInt(Math.abs(total));
  const divisor = BigInt(totalWeight);

  const remainders: { id: string; remainder: bigint }[] = [];
  let distributed = 0n;

  for (const entry of entries) {
    const product = magnitude * BigInt(entry.weight);
    const whole = product / divisor;
    const remainder = product % divisor;
    distributed += whole;
    remainders.push({ id: entry.id, remainder });
    result.set(entry.id, sign * Number(whole));
  }

  let leftover = Number(magnitude - distributed);

  remainders.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return compareIds(a.id, b.id);
  });

  for (let i = 0; i < leftover; i += 1) {
    const { id } = remainders[i];
    result.set(id, (result.get(id) as number) + sign);
  }
  leftover = 0;

  return result;
}

/**
 * Splits `total` as evenly as possible between `ids`, remainder by largest
 * remainder method — equal weights, so the leftover kopecks go to the smallest
 * ids. Used for the degenerate order case (§4.4), the "split equally" button of
 * the opening-balances form (§4.2) and fund-level adjustments.
 */
export function allocateEqually(total: Kopecks, ids: readonly string[]): Map<string, Kopecks> {
  return allocateByLargestRemainder(
    total,
    ids.map((id) => ({ id, weight: 1 })),
  );
}

/** An order paired with the interval over which it is consumed. */
export type ConsumptionPeriod = {
  order: WaterOrder;
  period: DateRange;
  isOpen: boolean;
};

/**
 * Consumption periods of §4.3: `P_k = [t_k, t_{k+1})`, and for the last order
 * `P_last = [t_last, asOf)` — the period that is still running.
 *
 * Note on the boundary: §4.3 writes the open period with a closed bracket, but
 * the worked example of §4.7 (05.06 → 05.07 = 30 days) counts it half-open, and
 * §4.1 defines `days` on `[a, b)`. Half-open everywhere is the consistent
 * reading: every calendar day then belongs to exactly one period, so no day is
 * ever paid for twice.
 *
 * Orders are sorted by date, ties broken by id. `asOf` earlier than the last
 * order yields an empty period, which the degenerate branch of §4.4 handles.
 */
export function buildConsumptionPeriods(
  orders: readonly WaterOrder[],
  asOf: IsoDate,
): ConsumptionPeriod[] {
  const sorted = [...orders].sort(
    (a, b) => compareDates(a.orderedAt, b.orderedAt) || compareIds(a.id, b.id),
  );

  return sorted.map((order, index) => {
    const next = sorted[index + 1];
    const isOpen = next === undefined;
    const to = isOpen ? maxDate(asOf, order.orderedAt) : maxDate(next.orderedAt, order.orderedAt);
    return { order, period: { from: order.orderedAt, to }, isOpen };
  });
}

/**
 * Participants who carry the cost of an order whose period has zero person-days
 * (§4.4 degenerate case: everybody was away for the whole period).
 *
 * The cost is split equally between the participants active on the order date.
 * If nobody was active on that exact day, the fallbacks are anybody whose
 * membership touched the period, then every known participant — the money did
 * leave the fund, so it has to land on somebody, or the invariant of §5 breaks.
 */
function degenerateRecipients(
  participants: readonly Participant[],
  order: WaterOrder,
  period: DateRange,
): Participant[] {
  const activeOnOrderDate = participants.filter((p) => isMemberOn(p, order.orderedAt));
  if (activeOnOrderDate.length > 0) return activeOnOrderDate;

  const touchingPeriod = participants.filter((p) => overlapsRange(p, period));
  if (touchingPeriod.length > 0) return touchingPeriod;

  if (participants.length === 0) {
    throw new RangeError(
      `order ${order.id} of ${order.amount} kopecks cannot be distributed: there are no participants`,
    );
  }
  return [...participants];
}

/**
 * Distributes one order over its consumption period (§4.4).
 *
 * `share_k(i) = C_k × days(i, P_k) / D_k`, rounded by §4.6 so that
 * `Σ_i share_k(i) = C_k` exactly. When `D_k = 0` the cost is split equally and
 * the result is flagged `isDegenerate` so the administrator can be shown the
 * anomaly.
 *
 * Shares that are zero *and* backed by zero days are dropped from the output —
 * they carry no information for the breakdown screen.
 */
export function distributeOrder(
  consumption: ConsumptionPeriod,
  participants: readonly Participant[],
  absences: readonly Absence[],
): OrderPeriod {
  const { order, period, isOpen } = consumption;
  assertKopecks(order.amount, `amount of order ${order.id}`);

  const days = participants.map((participant) => ({
    id: participant.id,
    weight: daysPresent(participant, absences, period.from, period.to),
  }));

  const totalPersonDays = days.reduce((sum, entry) => sum + entry.weight, 0);
  const isDegenerate = totalPersonDays === 0;

  const allocation = isDegenerate
    ? allocateEqually(order.amount, degenerateRecipients(participants, order, period).map((p) => p.id))
    : allocateByLargestRemainder(order.amount, days);

  const daysById = new Map(days.map((entry) => [entry.id, entry.weight]));

  const shares: OrderShare[] = [];
  for (const participant of participants) {
    const share = allocation.get(participant.id) ?? 0;
    const participantDays = daysById.get(participant.id) ?? 0;
    if (share === 0 && participantDays === 0) continue;
    shares.push({
      orderId: order.id,
      userId: participant.id,
      daysPresent: participantDays,
      totalPersonDays,
      share,
    });
  }

  return {
    orderId: order.id,
    orderedAt: order.orderedAt,
    amount: order.amount,
    period,
    isOpen,
    isDegenerate,
    totalPersonDays,
    shares,
  };
}

/** Convenience: the length of a consumption period in days. */
export function periodLength(period: DateRange): number {
  return dayCount(period);
}

/** All orders distributed, chronologically (§4.3 + §4.4). */
export function distributeOrders(
  orders: readonly WaterOrder[],
  participants: readonly Participant[],
  absences: readonly Absence[],
  asOf: IsoDate,
): OrderPeriod[] {
  return buildConsumptionPeriods(orders, asOf).map((consumption) =>
    distributeOrder(consumption, participants, absences),
  );
}
