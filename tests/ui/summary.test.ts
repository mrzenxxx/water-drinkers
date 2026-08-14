import { describe, expect, it } from 'vitest';

import type { Absence, Participant } from '@/lib/calc/types';
import { buildEvents, type EventSource } from '@/lib/view/events';
import { longestGapWithoutOrders, personDaysIn, summarizePeriod } from '@/lib/view/summary';

const PARTICIPANTS: Participant[] = [
  { id: 'u-1', joinedAt: '2026-06-01', leftAt: null, openingBalance: 0 },
  { id: 'u-2', joinedAt: '2026-06-11', leftAt: null, openingBalance: 0 },
];

const ABSENCES: Absence[] = [
  { id: 'a1', userId: 'u-1', type: 'VACATION', startsOn: '2026-06-05', endsOn: '2026-06-09' },
];

const SOURCE: EventSource = {
  contributions: [
    { id: 'c1', userId: 'u-1', amount: 200_000, paidAt: '2026-06-02', status: 'CONFIRMED' },
    { id: 'c2', userId: 'u-2', amount: 900_000, paidAt: '2026-06-12', status: 'PENDING' },
  ],
  orders: [
    { id: 'o1', amount: 300_000, orderedAt: '2026-06-05' },
    { id: 'o2', amount: 450_000, orderedAt: '2026-06-25' },
  ],
  absences: ABSENCES.map((absence) => ({ ...absence })),
  transactions: [
    { id: 't1', type: 'ADJUSTMENT', amount: 1_000, userId: null, occurredOn: '2026-06-15' },
    { id: 't2', type: 'SETTLEMENT', amount: -50_000, userId: 'u-1', occurredOn: '2026-06-28' },
  ],
};

const RANGE = { from: '2026-06-01', to: '2026-06-30' };

describe('человеко-дни периода', () => {
  it('учитывает вступление в середине и отсутствия', () => {
    // u-1: 30 дней членства − 5 дней отпуска = 25. u-2: с 11-го по 30-е = 20.
    expect(personDaysIn(PARTICIPANTS, ABSENCES, RANGE)).toBe(45);
  });

  it('не считает дни до вступления', () => {
    expect(personDaysIn(PARTICIPANTS, ABSENCES, { from: '2026-06-01', to: '2026-06-10' })).toBe(5);
  });
});

describe('самый длинный период без закупок', () => {
  it('считает и края периода, а не только промежутки между заказами', () => {
    expect(longestGapWithoutOrders(['2026-06-05', '2026-06-25'], RANGE)).toEqual({
      from: '2026-06-05',
      to: '2026-06-25',
      days: 20,
    });
  });

  it('без заказов вся длина периода — одна пауза', () => {
    expect(longestGapWithoutOrders([], RANGE)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
      days: 29,
    });
  });

  it('на пустом периоде паузы нет', () => {
    expect(longestGapWithoutOrders([], { from: '2026-06-10', to: '2026-06-01' })).toBeNull();
  });
});

describe('сводка за период', () => {
  const summary = summarizePeriod({
    events: buildEvents(SOURCE),
    participants: PARTICIPANTS,
    absences: ABSENCES,
    range: RANGE,
  });

  it('не засчитывает неподтверждённый взнос', () => {
    // 200 000 взноса + 1 000 положительной корректировки.
    expect(summary.received).toBe(201_000);
  });

  it('складывает расход из заказов, выплат и отрицательных корректировок', () => {
    expect(summary.spent).toBe(300_000 + 450_000 + 50_000);
  });

  it('изменение остатка — разница поступлений и расхода', () => {
    expect(summary.netChange).toBe(201_000 - 800_000);
  });

  it('средний расход в день считается целочисленно, без Math.round', () => {
    // 800 000 копеек за 30 дней = 26 666 копеек, остаток отбрасывается.
    expect(summary.averageDailySpend).toBe(26_666);
    expect(Number.isSafeInteger(summary.averageDailySpend)).toBe(true);
  });

  it('находит самый дорогой заказ и число заказов', () => {
    expect(summary.orderCount).toBe(2);
    expect(summary.largestOrder).toMatchObject({ date: '2026-06-25', amount: 450_000 });
  });

  it('пустой период не делит на ноль', () => {
    const empty = summarizePeriod({
      events: [],
      participants: [],
      absences: [],
      range: { from: '2026-06-10', to: '2026-06-01' },
    });
    expect(empty.days).toBe(0);
    expect(empty.averageDailySpend).toBe(0);
    expect(empty.largestOrder).toBeNull();
  });

  it('не берёт деньги вне периода', () => {
    const narrow = summarizePeriod({
      events: buildEvents(SOURCE),
      participants: PARTICIPANTS,
      absences: ABSENCES,
      range: { from: '2026-06-20', to: '2026-06-30' },
    });
    expect(narrow.received).toBe(0);
    expect(narrow.spent).toBe(450_000 + 50_000);
  });
});
