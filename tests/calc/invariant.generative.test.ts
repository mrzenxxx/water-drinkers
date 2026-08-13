/**
 * The main test of the project (SPEC §5, rule 1 of CLAUDE.md).
 *
 * Random sequences of operations — participants joining and leaving, absences,
 * contributions and their moderation, water orders, settlements and adjustments —
 * with the invariant `Σ балансов == остаток фонда` checked after **every single
 * operation**, not just at the end.
 *
 * The generator is a seeded PRNG, so any failure is reproducible: the seed is
 * printed with the failing assertion.
 */

import { describe, expect, it } from 'vitest';

import { isKopecks, sumMoney } from '@/lib/money';
import { allocateByLargestRemainder } from '@/lib/calc/shares';
import { computeBalances } from '@/lib/calc/balances';
import { checkInvariant, checkOrderShares } from '@/lib/calc/invariant';
import { addDays, compareDates } from '@/lib/calc/dates';
import type {
  Absence,
  CalcInput,
  Contribution,
  FundSettings,
  FundTransaction,
  IsoDate,
  Participant,
} from '@/lib/calc/types';

const RUNS = 500;
const MIN_OPERATIONS = 6;
const MAX_OPERATIONS = 40;

/** mulberry32 — small, fast, fully deterministic. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[int(rng, 0, items.length - 1)];
const chance = (rng: Rng, probability: number): boolean => rng() < probability;

type World = {
  participants: Participant[];
  absences: Absence[];
  orders: CalcInput['orders'] extends readonly (infer T)[] ? T[] : never;
  contributions: Contribution[];
  transactions: FundTransaction[];
  fund: FundSettings;
  today: IsoDate;
  nextId: number;
};

function id(world: World, prefix: string): string {
  world.nextId += 1;
  return `${prefix}-${String(world.nextId).padStart(4, '0')}`;
}

function activeParticipants(world: World): Participant[] {
  return world.participants.filter(
    (p) => p.leftAt === null && compareDates(p.joinedAt, world.today) <= 0,
  );
}

function toInput(world: World): CalcInput {
  return {
    participants: world.participants,
    absences: world.absences,
    orders: world.orders,
    contributions: world.contributions,
    transactions: world.transactions,
    fund: world.fund,
    asOf: world.today,
  };
}

/**
 * Builds a starting world: an opening state (§4.2) whose opening balances add up to
 * the fund's opening balance, or a clean start with no opening state.
 */
function makeWorld(rng: Rng): World {
  const withOpeningState = chance(rng, 0.7);
  const startDate: IsoDate | null = withOpeningState ? '2026-06-01' : null;
  const cohortSize = int(rng, 1, 8);

  const world: World = {
    participants: [],
    absences: [],
    orders: [],
    contributions: [],
    transactions: [],
    fund: { openingBalance: 0, startDate, defaultContribution: 500_00 },
    today: withOpeningState ? '2026-06-01' : '2026-01-15',
    nextId: 0,
  };

  const openingBalances: number[] = [];
  for (let i = 0; i < cohortSize; i += 1) {
    openingBalances.push(withOpeningState ? int(rng, -50_000, 200_000) : 0);
  }
  world.fund.openingBalance = openingBalances.reduce((sum, value) => sum + value, 0);

  for (let i = 0; i < cohortSize; i += 1) {
    world.participants.push({
      id: id(world, 'u'),
      joinedAt: withOpeningState ? '2026-01-01' : world.today,
      leftAt: null,
      openingBalance: openingBalances[i],
    });
  }

  return world;
}

type Operation = (world: World, rng: Rng) => void;

const advanceTime: Operation = (world, rng) => {
  world.today = addDays(world.today, int(rng, 0, 20));
};

const addParticipant: Operation = (world, rng) => {
  world.participants.push({
    id: id(world, 'u'),
    // Joining slightly in the past is allowed and is a common data-entry case.
    joinedAt: addDays(world.today, -int(rng, 0, 5)),
    leftAt: null,
    openingBalance: 0,
  });
};

const removeParticipant: Operation = (world, rng) => {
  const candidates = activeParticipants(world);
  // Never empty the roster: an order still has to land on somebody.
  if (candidates.length <= 1) return;
  const leaving = pick(rng, candidates);
  leaving.leftAt = compareDates(world.today, leaving.joinedAt) >= 0 ? world.today : leaving.joinedAt;

  if (chance(rng, 0.5)) {
    // Pay out whatever the leaver had — the common case of §16 question 3.
    const balance = computeBalances(toInput(world)).balances.find((b) => b.userId === leaving.id);
    const amount = balance ? balance.amount : 0;
    if (amount > 0) {
      world.transactions.push({
        id: id(world, 't'),
        type: 'SETTLEMENT',
        amount: -amount,
        userId: leaving.id,
        occurredOn: world.today,
      });
    }
  }
};

const addAbsence: Operation = (world, rng) => {
  const candidates = world.participants;
  if (candidates.length === 0) return;
  const who = pick(rng, candidates);
  const startsOn = addDays(world.today, int(rng, -20, 20));
  const endsOn = addDays(startsOn, int(rng, 0, 25));

  // The database forbids overlapping absences for one participant (§11); most of
  // the time we respect that, and sometimes we do not, to prove the core cannot
  // subtract a day twice even on bad data.
  const overlaps = world.absences.some(
    (existing) =>
      existing.userId === who.id &&
      compareDates(existing.startsOn, endsOn) <= 0 &&
      compareDates(startsOn, existing.endsOn) <= 0,
  );
  if (overlaps && !chance(rng, 0.15)) return;

  world.absences.push({
    id: id(world, 'a'),
    userId: who.id,
    type: chance(rng, 0.5) ? 'VACATION' : 'SICK_LEAVE',
    startsOn,
    endsOn,
  });
};

const submitContribution: Operation = (world, rng) => {
  const candidates = world.participants;
  if (candidates.length === 0) return;
  const who = pick(rng, candidates);
  world.contributions.push({
    id: id(world, 'c'),
    userId: who.id,
    amount: int(rng, 1, 1500) * 100,
    paidAt: addDays(world.today, -int(rng, 0, 10)),
    status: 'PENDING',
    historical: chance(rng, 0.05),
  });
};

const moderateContribution: Operation = (world, rng) => {
  const pending = world.contributions.filter((c) => c.status === 'PENDING');
  if (pending.length === 0) return;
  const target = pick(rng, pending);
  target.status = chance(rng, 0.8) ? 'CONFIRMED' : 'REJECTED';
};

const placeOrder: Operation = (world, rng) => {
  if (world.participants.length === 0) return;
  world.orders.push({
    id: id(world, 'o'),
    amount: int(rng, 1, 900_000),
    orderedAt: addDays(world.today, -int(rng, 0, 3)),
    historical: chance(rng, 0.05),
  });
};

const makeAdjustment: Operation = (world, rng) => {
  if (world.participants.length === 0) return;
  const attributed = chance(rng, 0.6);
  world.transactions.push({
    id: id(world, 't'),
    type: 'ADJUSTMENT',
    amount: (chance(rng, 0.5) ? 1 : -1) * int(rng, 1, 100_000),
    userId: attributed ? pick(rng, world.participants).id : null,
    occurredOn: world.today,
    comment: 'generated',
  });
};

const OPERATIONS: { run: Operation; weight: number }[] = [
  { run: advanceTime, weight: 6 },
  { run: addParticipant, weight: 2 },
  { run: removeParticipant, weight: 1 },
  { run: addAbsence, weight: 4 },
  { run: submitContribution, weight: 5 },
  { run: moderateContribution, weight: 5 },
  { run: placeOrder, weight: 4 },
  { run: makeAdjustment, weight: 2 },
];

const TOTAL_WEIGHT = OPERATIONS.reduce((sum, operation) => sum + operation.weight, 0);

function pickOperation(rng: Rng): Operation {
  let ticket = int(rng, 1, TOTAL_WEIGHT);
  for (const operation of OPERATIONS) {
    ticket -= operation.weight;
    if (ticket <= 0) return operation.run;
  }
  return OPERATIONS[0].run;
}

type Violation = {
  seed: number;
  step: number;
  reason: string;
  detail: unknown;
};

function verify(world: World, seed: number, step: number): Violation | null {
  const result = computeBalances(toInput(world));

  const mismatchedOrders = checkOrderShares(result);
  if (mismatchedOrders.length > 0) {
    return { seed, step, reason: 'order shares do not add up to the order amount', detail: mismatchedOrders };
  }

  for (const balance of result.balances) {
    if (!isKopecks(balance.amount)) {
      return { seed, step, reason: 'balance is not an integer number of kopecks', detail: balance };
    }
    const b = balance.breakdown;
    const recomputed =
      b.openingBalance + b.contributionsTotal - b.expensesTotal + b.settlementsTotal + b.adjustmentsTotal;
    if (recomputed !== balance.amount) {
      return { seed, step, reason: 'breakdown does not reproduce the balance', detail: balance };
    }
  }

  const report = checkInvariant(result);
  if (!report.isConsistent) {
    return {
      seed,
      step,
      reason: 'Σ balances != fund balance',
      detail: {
        ...report,
        participants: world.participants.length,
        orders: world.orders.length,
        today: world.today,
      },
    };
  }

  return null;
}

describe('generative invariant test (§5) — the main test of the project', () => {
  it(`holds after every operation across ${RUNS} random histories`, () => {
    const violations: Violation[] = [];
    let operationsChecked = 0;

    for (let seed = 1; seed <= RUNS; seed += 1) {
      const rng = makeRandom(seed);
      const world = makeWorld(rng);

      const initial = verify(world, seed, 0);
      if (initial) {
        violations.push(initial);
        continue;
      }
      operationsChecked += 1;

      const steps = int(rng, MIN_OPERATIONS, MAX_OPERATIONS);
      for (let step = 1; step <= steps; step += 1) {
        pickOperation(rng)(world, rng);
        const violation = verify(world, seed, step);
        operationsChecked += 1;
        if (violation) {
          violations.push(violation);
          break;
        }
      }
    }

    expect(violations, `invariant violations:\n${JSON.stringify(violations.slice(0, 3), null, 2)}`).toEqual([]);
    // Sanity check on the generator itself: it must actually be doing work.
    expect(operationsChecked).toBeGreaterThan(RUNS * MIN_OPERATIONS);
  });

  it('produces histories that exercise every branch', () => {
    let withOrders = 0;
    let withDegenerateOrder = 0;
    let withLeavers = 0;
    let withFundLevelAdjustment = 0;
    let withAbsences = 0;
    let withNegativeBalance = 0;

    for (let seed = 1; seed <= RUNS; seed += 1) {
      const rng = makeRandom(seed);
      const world = makeWorld(rng);
      const steps = int(rng, MIN_OPERATIONS, MAX_OPERATIONS);
      for (let step = 1; step <= steps; step += 1) {
        pickOperation(rng)(world, rng);
      }

      const result = computeBalances(toInput(world));
      if (result.orderPeriods.length > 0) withOrders += 1;
      if (result.orderPeriods.some((period) => period.isDegenerate)) withDegenerateOrder += 1;
      if (world.participants.some((p) => p.leftAt !== null)) withLeavers += 1;
      if (world.transactions.some((t) => t.userId === null)) withFundLevelAdjustment += 1;
      if (world.absences.length > 0) withAbsences += 1;
      if (result.balances.some((b) => b.owes)) withNegativeBalance += 1;
    }

    expect(withOrders).toBeGreaterThan(RUNS / 2);
    expect(withDegenerateOrder).toBeGreaterThan(0);
    expect(withLeavers).toBeGreaterThan(0);
    expect(withFundLevelAdjustment).toBeGreaterThan(0);
    expect(withAbsences).toBeGreaterThan(RUNS / 2);
    expect(withNegativeBalance).toBeGreaterThan(0);
  });
});

describe('generative allocation test (§4.6)', () => {
  it('sums to the total for 5000 random weight vectors', () => {
    const rng = makeRandom(20260814);
    const failures: unknown[] = [];

    for (let run = 0; run < 5000; run += 1) {
      const count = int(rng, 1, 12);
      const entries = Array.from({ length: count }, (_, index) => ({
        id: `u${String(int(rng, 0, 999)).padStart(3, '0')}-${index}`,
        weight: chance(rng, 0.15) ? 0 : int(rng, 1, 400),
      }));
      if (entries.every((entry) => entry.weight === 0)) entries[0].weight = 1;

      const total = (chance(rng, 0.2) ? -1 : 1) * int(rng, 0, 5_000_000);
      const allocation = allocateByLargestRemainder(total, entries);

      if (sumMoney(allocation.values()) !== total) {
        failures.push({ total, entries, allocation: [...allocation.entries()] });
        continue;
      }
      for (const entry of entries) {
        if (entry.weight === 0 && allocation.get(entry.id) !== 0) {
          failures.push({ reason: 'zero weight received money', total, entries });
          break;
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
