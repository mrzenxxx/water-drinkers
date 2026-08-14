import { describe, expect, it } from 'vitest';

import { addDays, computeBalances } from '@/lib/calc';
import type { CalcInput } from '@/lib/calc/types';
import { buildEvents, type EventSource } from '@/lib/view/events';
import { bucketKeyOf } from '@/lib/view/filters';
import {
  balanceBefore,
  bucketKeys,
  buildBalanceSeries,
  daysBetween,
  fundDeltas,
  zeroCrossings,
} from '@/lib/view/series';

const SOURCE: EventSource = {
  contributions: [
    { id: 'c1', userId: 'u-1', amount: 100_000, paidAt: '2026-06-02', status: 'CONFIRMED' },
    { id: 'c2', userId: 'u-2', amount: 100_000, paidAt: '2026-06-02', status: 'CONFIRMED' },
    // Неподтверждённый взнос денег фонду не даёт (правило 6).
    { id: 'c3', userId: 'u-2', amount: 500_000, paidAt: '2026-06-03', status: 'PENDING' },
    { id: 'c4', userId: 'u-1', amount: 40_000, paidAt: '2026-06-20', status: 'REJECTED' },
  ],
  orders: [{ id: 'o1', amount: 300_000, orderedAt: '2026-06-10' }],
  absences: [
    { id: 'a1', userId: 'u-1', type: 'SICK_LEAVE', startsOn: '2026-06-12', endsOn: '2026-06-14' },
  ],
  transactions: [],
};

describe('денежные движения ленты', () => {
  it('берёт только подтверждённые взносы', () => {
    const deltas = fundDeltas(buildEvents(SOURCE));
    expect(deltas).toEqual([
      { date: '2026-06-02', amount: 100_000 },
      { date: '2026-06-02', amount: 100_000 },
      { date: '2026-06-10', amount: -300_000 },
    ]);
  });

  it('остаток на утро дня не включает операции этого дня', () => {
    const deltas = fundDeltas(buildEvents(SOURCE));
    expect(balanceBefore(deltas, '2026-06-02', 0)).toBe(0);
    expect(balanceBefore(deltas, '2026-06-03', 0)).toBe(200_000);
    expect(balanceBefore(deltas, '2026-06-11', 0)).toBe(-100_000);
  });
});

describe('ряд остатка', () => {
  const range = { from: '2026-06-01', to: '2026-06-14' };
  const keys = bucketKeys(range, bucketKeyOf('day'), (key) => addDays(key, 1));

  it('строит сплошной ряд корзин, включая пустые', () => {
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe('2026-06-01');
    expect(keys[13]).toBe('2026-06-14');
  });

  it('держит остаток между операциями и меняет его скачком', () => {
    const series = buildBalanceSeries(fundDeltas(buildEvents(SOURCE)), 0, range, keys);
    expect(series.startBalance).toBe(0);
    expect(series.points[0]?.balance).toBe(0);
    expect(series.points[1]?.balance).toBe(200_000); // 02.06 — два взноса
    expect(series.points[8]?.balance).toBe(200_000); // 09.06 — тишина
    expect(series.points[9]?.balance).toBe(-100_000); // 10.06 — заказ
    expect(series.min).toBe(-100_000);
    expect(series.max).toBe(200_000);
    expect(series.crossesZero).toBe(true);
  });

  it('период после всех операций начинается с накопленного остатка', () => {
    const later = { from: '2026-06-20', to: '2026-06-22' };
    const laterKeys = bucketKeys(later, bucketKeyOf('day'), (key) => addDays(key, 1));
    const series = buildBalanceSeries(fundDeltas(buildEvents(SOURCE)), 0, later, laterKeys);
    expect(series.startBalance).toBe(-100_000);
    expect(series.points.every((point) => point.balance === -100_000)).toBe(true);
  });

  it('не даёт опечатке в дате развернуть тысячи корзин', () => {
    const huge = bucketKeys(
      { from: '0226-01-01', to: '2026-01-01' },
      bucketKeyOf('day'),
      (key) => addDays(key, 1),
      50,
    );
    expect(huge).toHaveLength(50);
  });

  it('находит точки перехода через ноль', () => {
    expect(
      zeroCrossings([
        { date: '1', balance: 100 },
        { date: '2', balance: 10 },
        { date: '3', balance: -5 },
        { date: '4', balance: -50 },
        { date: '5', balance: 5 },
      ]),
    ).toEqual([2, 4]);
  });

  it('считает расстояние между датами без отрицательных', () => {
    expect(daysBetween('2026-06-01', '2026-06-10')).toBe(9);
    expect(daysBetween('2026-06-10', '2026-06-01')).toBe(0);
  });
});

/**
 * Главная страховка дашборда: §6.9 требует, чтобы график не расходился
 * с таблицами и инвариантом §5. Ряд остатка строится своим кодом — значит
 * его последняя точка обязана совпасть с остатком фонда из ядра расчёта.
 */
describe('ряд сходится с ядром расчёта', () => {
  it('последняя точка равна CalcResult.fundBalance', () => {
    const asOf = '2026-06-30';
    const input: CalcInput = {
      participants: [
        { id: 'u-1', joinedAt: '2026-06-01', leftAt: null, openingBalance: 25_000 },
        { id: 'u-2', joinedAt: '2026-06-01', leftAt: null, openingBalance: 25_000 },
      ],
      absences: [
        { id: 'a1', userId: 'u-1', type: 'SICK_LEAVE', startsOn: '2026-06-12', endsOn: '2026-06-14' },
      ],
      orders: [{ id: 'o1', amount: 300_000, orderedAt: '2026-06-10' }],
      contributions: SOURCE.contributions.map((row) => ({ ...row })),
      transactions: [
        {
          id: 't1',
          type: 'ADJUSTMENT',
          amount: -1_500,
          userId: null,
          occurredOn: '2026-06-18',
        },
      ],
      fund: { openingBalance: 50_000, startDate: '2026-06-01', defaultContribution: 50_000 },
      asOf,
    };

    const result = computeBalances(input);

    const source: EventSource = {
      contributions: input.contributions.map((row) => ({ ...row })),
      orders: input.orders.map((row) => ({ ...row })),
      absences: input.absences.map((row) => ({ ...row })),
      transactions: (input.transactions ?? []).map((row) => ({ ...row })),
    };

    const range = { from: '2026-06-01', to: asOf };
    const keys = bucketKeys(range, bucketKeyOf('day'), (key) => addDays(key, 1));
    const series = buildBalanceSeries(
      fundDeltas(buildEvents(source)),
      input.fund.openingBalance,
      range,
      keys,
    );

    expect(series.points[series.points.length - 1]?.balance).toBe(result.fundBalance);
  });
});
