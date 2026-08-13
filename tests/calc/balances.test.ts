import { describe, expect, it } from 'vitest';

import { sumMoney } from '@/lib/money';
import { computeBalances, splitOpeningBalanceEqually } from '@/lib/calc/balances';
import { assertInvariant, checkOpeningInvariant, checkOrderShares } from '@/lib/calc/invariant';
import type { CalcInput, Contribution, FundSettings, Participant } from '@/lib/calc/types';

const RUB = 100;

function fund(over: Partial<FundSettings> = {}): FundSettings {
  return { openingBalance: 0, startDate: null, defaultContribution: 500 * RUB, ...over };
}

function participant(id: string, over: Partial<Participant> = {}): Participant {
  return { id, joinedAt: '2020-01-01', leftAt: null, openingBalance: 0, ...over };
}

function confirmed(id: string, userId: string, amount: number, paidAt: string): Contribution {
  return { id, userId, amount, paidAt, status: 'CONFIRMED' };
}

function balanceOf(result: ReturnType<typeof computeBalances>, userId: string): number {
  const balance = result.balances.find((b) => b.userId === userId);
  if (!balance) throw new Error(`no balance for ${userId}`);
  return balance.amount;
}

describe('worked example of §4.7', () => {
  // 8 participants, accounting started on 01.06 with 1 000 ₽ in the fund (125 ₽ each).
  // An order of 3 000 ₽ on 05.06, today is 05.07, no further orders.
  // Ivan was away for 15 of those days. Everybody contributed 500 ₽.
  const ivan = 'u1';
  const participants: Participant[] = Array.from({ length: 8 }, (_, index) =>
    participant(`u${index + 1}`, { openingBalance: 125 * RUB }),
  );

  const input: CalcInput = {
    participants,
    absences: [{ id: 'a1', userId: ivan, type: 'VACATION', startsOn: '2026-06-05', endsOn: '2026-06-19' }],
    orders: [{ id: 'o1', amount: 3000 * RUB, orderedAt: '2026-06-05' }],
    contributions: participants.map((p) => confirmed(`c-${p.id}`, p.id, 500 * RUB, '2026-06-10')),
    fund: fund({ openingBalance: 1000 * RUB, startDate: '2026-06-01' }),
    asOf: '2026-07-05',
  };

  const result = computeBalances(input);
  const [period] = result.orderPeriods;

  it('counts 225 person-days over a 30-day period', () => {
    expect(period.period).toEqual({ from: '2026-06-05', to: '2026-07-05' });
    expect(period.totalPersonDays).toBe(7 * 30 + 15);
    expect(period.shares.find((s) => s.userId === ivan)?.daysPresent).toBe(15);
  });

  it('charges Ivan 200 ₽ and everybody else 400 ₽', () => {
    const shares = new Map(period.shares.map((s) => [s.userId, s.share]));
    expect(shares.get(ivan)).toBe(200 * RUB);
    for (const p of participants.slice(1)) {
      expect(shares.get(p.id)).toBe(400 * RUB);
    }
    expect(sumMoney(period.shares.map((s) => s.share))).toBe(3000 * RUB);
  });

  it('produces the balances of the table: +425 ₽ for Ivan, +225 ₽ for the rest', () => {
    expect(balanceOf(result, ivan)).toBe(425 * RUB);
    for (const p of participants.slice(1)) {
      expect(balanceOf(result, p.id)).toBe(225 * RUB);
    }
  });

  it('leaves 2 000 ₽ in the fund and the invariant holds', () => {
    expect(result.fundBalance).toBe(2000 * RUB);
    expect(sumMoney(result.balances.map((b) => b.amount))).toBe(2000 * RUB);
    expect(assertInvariant(result).difference).toBe(0);
    expect(checkOrderShares(result)).toEqual([]);
  });
});

describe('balances (§4.5)', () => {
  const base: CalcInput = {
    participants: [participant('u1'), participant('u2')],
    absences: [],
    orders: [],
    contributions: [],
    fund: fund(),
    asOf: '2026-07-01',
  };

  it('ignores contributions that are not confirmed (rule 6)', () => {
    const result = computeBalances({
      ...base,
      contributions: [
        confirmed('c1', 'u1', 500 * RUB, '2026-06-01'),
        { id: 'c2', userId: 'u2', amount: 500 * RUB, paidAt: '2026-06-01', status: 'PENDING' },
        { id: 'c3', userId: 'u2', amount: 700 * RUB, paidAt: '2026-06-01', status: 'REJECTED' },
      ],
    });

    expect(balanceOf(result, 'u1')).toBe(500 * RUB);
    expect(balanceOf(result, 'u2')).toBe(0);
    expect(result.fundBalance).toBe(500 * RUB);
    assertInvariant(result);
  });

  it('excludes everything before the start date and every historical record (§4.2)', () => {
    const result = computeBalances({
      ...base,
      participants: base.participants.map((p) => ({ ...p, openingBalance: 100 * RUB })),
      fund: fund({ openingBalance: 200 * RUB, startDate: '2026-06-01' }),
      contributions: [
        confirmed('old', 'u1', 999 * RUB, '2026-05-31'),
        { ...confirmed('hist', 'u1', 888 * RUB, '2026-06-02'), historical: true },
        confirmed('new', 'u1', 500 * RUB, '2026-06-01'),
      ],
      orders: [
        { id: 'old', amount: 300 * RUB, orderedAt: '2026-05-20' },
        { id: 'hist', amount: 400 * RUB, orderedAt: '2026-06-03', historical: true },
      ],
    });

    expect(result.orderPeriods).toHaveLength(0);
    expect(balanceOf(result, 'u1')).toBe(600 * RUB);
    expect(balanceOf(result, 'u2')).toBe(100 * RUB);
    expect(result.fundBalance).toBe(700 * RUB);
    assertInvariant(result);
  });

  it('applies a settlement to the leaving participant and to the fund', () => {
    const result = computeBalances({
      ...base,
      contributions: [confirmed('c1', 'u1', 500 * RUB, '2026-06-01')],
      transactions: [
        { id: 't1', type: 'SETTLEMENT', amount: -500 * RUB, userId: 'u1', occurredOn: '2026-06-20' },
      ],
    });

    expect(balanceOf(result, 'u1')).toBe(0);
    expect(result.fundBalance).toBe(0);
    assertInvariant(result);
  });

  it('spreads a fund-level adjustment across the participants active that day', () => {
    const result = computeBalances({
      ...base,
      participants: [participant('u1'), participant('u2'), participant('u3', { joinedAt: '2027-01-01' })],
      transactions: [{ id: 't1', type: 'ADJUSTMENT', amount: 101, userId: null, occurredOn: '2026-06-20' }],
    });

    expect(balanceOf(result, 'u1')).toBe(51);
    expect(balanceOf(result, 'u2')).toBe(50);
    expect(balanceOf(result, 'u3')).toBe(0);
    expect(result.fundBalance).toBe(101);
    assertInvariant(result);
  });

  it('applies an attributed adjustment to that participant only', () => {
    const result = computeBalances({
      ...base,
      transactions: [{ id: 't1', type: 'ADJUSTMENT', amount: -250, userId: 'u2', occurredOn: '2026-06-20' }],
    });

    expect(balanceOf(result, 'u1')).toBe(0);
    expect(balanceOf(result, 'u2')).toBe(-250);
    expect(result.balances.find((b) => b.userId === 'u2')?.owes).toBe(true);
    assertInvariant(result);
  });

  it('keeps a breakdown that reproduces the balance', () => {
    const result = computeBalances({
      ...base,
      participants: base.participants.map((p) => ({ ...p, openingBalance: 100 * RUB })),
      fund: fund({ openingBalance: 200 * RUB, startDate: '2026-05-01' }),
      contributions: [confirmed('c1', 'u1', 500 * RUB, '2026-06-01')],
      orders: [{ id: 'o1', amount: 300 * RUB, orderedAt: '2026-06-01' }],
      transactions: [{ id: 't1', type: 'ADJUSTMENT', amount: -1000, userId: 'u1', occurredOn: '2026-06-05' }],
    });

    for (const balance of result.balances) {
      const b = balance.breakdown;
      expect(
        b.openingBalance + b.contributionsTotal - b.expensesTotal + b.settlementsTotal + b.adjustmentsTotal,
      ).toBe(balance.amount);
      expect(sumMoney(b.orderShares.map((s) => s.share))).toBe(b.expensesTotal);
    }
    assertInvariant(result);
  });

  it('rejects malformed input rather than quietly losing money', () => {
    expect(() =>
      computeBalances({ ...base, participants: [participant('u1'), participant('u1')] }),
    ).toThrow();

    expect(() =>
      computeBalances({ ...base, contributions: [confirmed('c1', 'ghost', 100, '2026-06-01')] }),
    ).toThrow();

    expect(() =>
      computeBalances({
        ...base,
        transactions: [{ id: 't1', type: 'SETTLEMENT', amount: -100, userId: null, occurredOn: '2026-06-01' }],
      }),
    ).toThrow();

    expect(() =>
      computeBalances({
        ...base,
        transactions: [{ id: 't1', type: 'SETTLEMENT', amount: 100, userId: 'u1', occurredOn: '2026-06-01' }],
      }),
    ).toThrow();

    expect(() => computeBalances({ ...base, orders: [{ id: 'o1', amount: 0, orderedAt: '2026-06-01' }] })).toThrow();
  });
});

describe('opening balances (§4.2)', () => {
  it('refuses an opening state whose opening balances do not add up', () => {
    const participants = [
      participant('u1', { openingBalance: 400 * RUB }),
      participant('u2', { openingBalance: 500 * RUB }),
    ];
    const report = checkOpeningInvariant(participants, 1000 * RUB);
    expect(report.isConsistent).toBe(false);
    expect(report.difference).toBe(-100 * RUB);
  });

  it('"split equally" always satisfies the opening invariant', () => {
    for (const count of [1, 3, 7, 8, 13]) {
      const ids = Array.from({ length: count }, (_, index) => `u${index + 1}`);
      const total = 100_000 + count;
      const split = splitOpeningBalanceEqually(total, ids);
      const participants = ids.map((id) => participant(id, { openingBalance: split.get(id) as number }));
      expect(checkOpeningInvariant(participants, total).isConsistent).toBe(true);
    }
  });

  it('carries a mismatched opening state through to a failing invariant', () => {
    const result = computeBalances({
      participants: [participant('u1', { openingBalance: 400 * RUB })],
      absences: [],
      orders: [],
      contributions: [],
      fund: fund({ openingBalance: 1000 * RUB, startDate: '2026-06-01' }),
      asOf: '2026-07-01',
    });
    // The core does not paper over bad data: the invariant reports the gap.
    expect(() => assertInvariant(result)).toThrow(/Invariant violated/);
  });
});
