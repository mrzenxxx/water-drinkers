import { describe, expect, it } from 'vitest';

import { sumMoney } from '@/lib/money';
import {
  allocateByLargestRemainder,
  allocateEqually,
  buildConsumptionPeriods,
  distributeOrder,
  distributeOrders,
} from '@/lib/calc/shares';
import type { Absence, Participant, WaterOrder } from '@/lib/calc/types';

function people(count: number, over: Partial<Participant> = {}): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `u${index + 1}`,
    joinedAt: '2020-01-01',
    leftAt: null,
    openingBalance: 0,
    ...over,
  }));
}

function order(id: string, orderedAt: string, amount: number): WaterOrder {
  return { id, orderedAt, amount };
}

function absence(userId: string, startsOn: string, endsOn: string, type: Absence['type'] = 'VACATION'): Absence {
  return { id: `${userId}-${startsOn}`, userId, type, startsOn, endsOn };
}

function sharesOf(participants: Participant[], absences: Absence[], theOrder: WaterOrder, to: string) {
  const period = distributeOrder(
    { order: theOrder, period: { from: theOrder.orderedAt, to }, isOpen: true },
    participants,
    absences,
  );
  const byUser = new Map(period.shares.map((share) => [share.userId, share.share]));
  return { period, byUser };
}

describe('largest remainder method (§4.6)', () => {
  it('always sums to exactly the distributed amount', () => {
    const cases: { total: number; weights: number[] }[] = [
      { total: 100, weights: [1, 1, 1] },
      { total: 1000, weights: [1, 1, 1, 1, 1, 1, 1] },
      { total: 100, weights: [1, 1, 1, 1, 1, 1, 1, 1] },
      { total: 300_000, weights: [30, 30, 30, 30, 30, 30, 30, 15] },
      { total: 1, weights: [5, 5] },
      { total: 7, weights: [3, 0, 4] },
      { total: 999_999_999, weights: [7, 11, 13, 17, 19] },
    ];

    for (const { total, weights } of cases) {
      const entries = weights.map((weight, index) => ({ id: `u${index + 1}`, weight }));
      const allocation = allocateByLargestRemainder(total, entries);
      expect(sumMoney(allocation.values())).toBe(total);
    }
  });

  it('spreads leftover kopecks between 3, 7 and 8 participants (§15)', () => {
    // 100 / 3 = 33.33 → one extra kopeck.
    const three = allocateEqually(100, ['u1', 'u2', 'u3']);
    expect([...three.values()]).toEqual([34, 33, 33]);
    expect(sumMoney(three.values())).toBe(100);

    // 1000 / 7 = 142.857 → six extra kopecks.
    const seven = allocateEqually(1000, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    expect([...seven.values()]).toEqual([143, 143, 143, 143, 143, 143, 142]);
    expect(sumMoney(seven.values())).toBe(1000);

    // 100 / 8 = 12.5 → four extra kopecks.
    const eight = allocateEqually(100, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']);
    expect([...eight.values()]).toEqual([13, 13, 13, 13, 12, 12, 12, 12]);
    expect(sumMoney(eight.values())).toBe(100);
  });

  it('breaks ties by ascending id, deterministically', () => {
    const forward = allocateEqually(100, ['c', 'a', 'b']);
    const backward = allocateEqually(100, ['b', 'c', 'a']);
    expect(forward.get('a')).toBe(34);
    expect(forward.get('b')).toBe(33);
    expect(forward.get('c')).toBe(33);
    expect([...backward.entries()].sort()).toEqual([...forward.entries()].sort());
  });

  it('never gives a kopeck to a zero-weight recipient', () => {
    const allocation = allocateByLargestRemainder(100, [
      { id: 'u1', weight: 1 },
      { id: 'u2', weight: 1 },
      { id: 'u3', weight: 1 },
      { id: 'idle', weight: 0 },
    ]);
    expect(allocation.get('idle')).toBe(0);
    expect(sumMoney(allocation.values())).toBe(100);
  });

  it('distributes negative amounts exactly too', () => {
    const allocation = allocateEqually(-100, ['u1', 'u2', 'u3']);
    expect([...allocation.values()]).toEqual([-34, -33, -33]);
    expect(sumMoney(allocation.values())).toBe(-100);
  });

  it('refuses impossible allocations', () => {
    expect(() => allocateEqually(100, [])).toThrow();
    expect(() => allocateByLargestRemainder(100, [{ id: 'u1', weight: 0 }])).toThrow();
    expect(() => allocateByLargestRemainder(1, [{ id: 'u1', weight: -1 }])).toThrow();
    expect(() => allocateByLargestRemainder(1, [{ id: 'u1', weight: 1 }, { id: 'u1', weight: 1 }])).toThrow();
    expect(sumMoney(allocateEqually(0, []).values())).toBe(0);
  });
});

describe('consumption periods (§4.3)', () => {
  it('runs each period up to the next order and leaves the last one open', () => {
    const periods = buildConsumptionPeriods(
      [order('o2', '2026-07-01', 1000), order('o1', '2026-06-01', 1000), order('o3', '2026-08-01', 1000)],
      '2026-08-15',
    );

    expect(periods.map((p) => p.order.id)).toEqual(['o1', 'o2', 'o3']);
    expect(periods[0].period).toEqual({ from: '2026-06-01', to: '2026-07-01' });
    expect(periods[1].period).toEqual({ from: '2026-07-01', to: '2026-08-01' });
    expect(periods[2].period).toEqual({ from: '2026-08-01', to: '2026-08-15' });
    expect(periods.map((p) => p.isOpen)).toEqual([false, false, true]);
  });

  it('gives two orders on one day a zero-length period between them', () => {
    const periods = buildConsumptionPeriods(
      [order('a', '2026-06-01', 1000), order('b', '2026-06-01', 1000)],
      '2026-06-10',
    );
    expect(periods[0].period).toEqual({ from: '2026-06-01', to: '2026-06-01' });
    expect(periods[1].period).toEqual({ from: '2026-06-01', to: '2026-06-10' });
  });
});

describe('order distribution (§4.4)', () => {
  it('splits in proportion to days present', () => {
    const participants = people(2);
    const { byUser, period } = sharesOf(
      participants,
      [absence('u2', '2026-06-01', '2026-06-05')],
      order('o1', '2026-06-01', 100_00),
      '2026-06-11',
    );
    // u1: 10 days, u2: 5 days → 15 person-days.
    expect(period.totalPersonDays).toBe(15);
    expect(byUser.get('u1')).toBe(6667);
    expect(byUser.get('u2')).toBe(3333);
    expect(sumMoney(period.shares.map((s) => s.share))).toBe(100_00);
  });

  it('charges nothing for an order made on the first day of an absence covering the period', () => {
    const participants = people(2);
    const { byUser, period } = sharesOf(
      participants,
      [absence('u2', '2026-06-01', '2026-06-10')],
      order('o1', '2026-06-01', 100_00),
      '2026-06-11',
    );
    expect(period.shares.find((s) => s.userId === 'u2')).toBeUndefined();
    expect(byUser.get('u1')).toBe(100_00);
    expect(period.isDegenerate).toBe(false);
  });

  it('counts back-to-back vacation and sick leave as one continuous absence', () => {
    const participants = people(2);
    const { period } = sharesOf(
      participants,
      [
        absence('u2', '2026-06-01', '2026-06-05', 'VACATION'),
        absence('u2', '2026-06-06', '2026-06-10', 'SICK_LEAVE'),
      ],
      order('o1', '2026-06-01', 100_00),
      '2026-06-21',
    );
    // u1: 20 days, u2: 10 days (absent for the first 10).
    expect(period.totalPersonDays).toBe(30);
    expect(period.shares.find((s) => s.userId === 'u2')?.daysPresent).toBe(10);
  });

  it('charges a participant who joined mid-period only for their days', () => {
    const participants: Participant[] = [
      { id: 'u1', joinedAt: '2020-01-01', leftAt: null, openingBalance: 0 },
      { id: 'u2', joinedAt: '2026-06-11', leftAt: null, openingBalance: 0 },
    ];
    const { byUser, period } = sharesOf(participants, [], order('o1', '2026-06-01', 300_00), '2026-06-21');
    // u1: 20 days, u2: 10 days → 30 person-days, 1000,00 ₽ per 10 days.
    expect(period.totalPersonDays).toBe(30);
    expect(byUser.get('u1')).toBe(200_00);
    expect(byUser.get('u2')).toBe(100_00);
  });

  it('splits equally when the period has zero person-days (§4.4 degenerate case)', () => {
    const participants = people(3);
    const absences = participants.map((p) => absence(p.id, '2026-06-01', '2026-06-30'));
    const { byUser, period } = sharesOf(participants, absences, order('o1', '2026-06-01', 100_01), '2026-06-11');

    expect(period.totalPersonDays).toBe(0);
    expect(period.isDegenerate).toBe(true);
    expect(byUser.get('u1')).toBe(3334);
    expect(byUser.get('u2')).toBe(3334);
    expect(byUser.get('u3')).toBe(3333);
    expect(sumMoney(period.shares.map((s) => s.share))).toBe(100_01);
  });

  it('splits an empty period equally between the participants active that day', () => {
    // Two orders on the same day: the first has a zero-length period.
    const participants = people(4);
    const periods = distributeOrders(
      [order('a', '2026-06-01', 100_00), order('b', '2026-06-01', 100_00)],
      participants,
      [],
      '2026-06-11',
    );
    expect(periods[0].isDegenerate).toBe(true);
    expect(sumMoney(periods[0].shares.map((s) => s.share))).toBe(100_00);
    expect(periods[0].shares.every((s) => s.share === 2500)).toBe(true);

    expect(periods[1].isDegenerate).toBe(false);
    expect(sumMoney(periods[1].shares.map((s) => s.share))).toBe(100_00);
  });

  it('falls back to participants of the period when nobody is active on the order date', () => {
    const participants = people(2, { joinedAt: '2026-06-05' });
    const periods = distributeOrders([order('a', '2026-06-01', 100_00)], participants, [], '2026-06-11');
    // Nobody was a member on 01.06, but both joined inside the period.
    expect(sumMoney(periods[0].shares.map((s) => s.share))).toBe(100_00);
  });

  it('refuses to distribute an order when there are no participants at all', () => {
    expect(() => distributeOrders([order('a', '2026-06-01', 100_00)], [], [], '2026-06-01')).toThrow();
  });
});
