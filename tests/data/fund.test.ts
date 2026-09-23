import { afterEach, describe, expect, it, vi } from 'vitest';

import { addDays } from '@/lib/calc';
import { fundFlowStats, loadCalcInput, loadFundState, monthlyStats } from '@/lib/data/fund';
import { startOfWeek } from '@/lib/format/dates';
import { createFakeDb, dateColumn, type FakeDb } from '../support/fake-prisma';

const RUB = 100;

/**
 * Пример §4.7 на строках таблиц: 8 участников, учёт с 01.06 и 1 000 ₽ в фонде,
 * заказ 05.06 на 3 000 ₽, Иван в отпуске 15 дней, каждый внёс по 500 ₽.
 * Ожидаемые числа взяты из спецификации, а не из текущего кода.
 */
function seedSpecExample(): FakeDb {
  const db = createFakeDb();

  db.tables.fundSettings.seed([
    { id: 1, openingBalance: BigInt(1000 * RUB), startDate: dateColumn('2026-06-01') },
  ]);

  for (let index = 0; index < 8; index += 1) {
    db.tables.user.seed([
      {
        id: `u${index}`,
        email: `p${index}@sspk.spb.ru`,
        role: index === 0 ? 'ADMIN' : 'PARTICIPANT',
        joinedAt: dateColumn('2026-06-01'),
        openingBalance: BigInt(125 * RUB),
      },
    ]);
  }

  db.tables.waterOrder.seed([
    {
      id: 'o1',
      amount: BigInt(3000 * RUB),
      orderedAt: dateColumn('2026-06-05'),
      createdBy: 'u0',
    },
  ]);

  // Иван — u1, отпуск ровно 15 дней внутри периода [05.06, 05.07).
  db.tables.absence.seed([
    {
      id: 'a1',
      userId: 'u1',
      type: 'VACATION',
      startsOn: dateColumn('2026-06-06'),
      endsOn: dateColumn('2026-06-20'),
    },
  ]);

  for (let index = 0; index < 8; index += 1) {
    db.tables.contribution.seed([
      {
        id: `c${index}`,
        userId: `u${index}`,
        amount: BigInt(500 * RUB),
        paidAt: dateColumn('2026-06-02'),
        status: 'CONFIRMED',
      },
    ]);
  }

  return db;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('сборка CalcInput', () => {
  it('переводит строки в чистые типы ядра', async () => {
    const db = seedSpecExample();
    const input = await loadCalcInput(db.client, '2026-07-05');

    expect(input.fund).toEqual({
      openingBalance: 1000 * RUB,
      startDate: '2026-06-01',
      defaultContribution: 50_000,
    });
    expect(input.participants).toHaveLength(8);
    expect(input.participants[0]).toEqual({
      id: 'u0',
      joinedAt: '2026-06-01',
      leftAt: null,
      openingBalance: 125 * RUB,
    });
    expect(input.orders).toEqual([
      { id: 'o1', amount: 3000 * RUB, orderedAt: '2026-06-05', historical: false },
    ]);
    expect(input.asOf).toBe('2026-07-05');
  });

  it('не тащит в ядро операции, выводимые из своих таблиц', async () => {
    const db = seedSpecExample();
    // Так журнал выглядит после подтверждения взноса и внесения заказа.
    db.tables.fundTransaction.seed([
      { type: 'CONTRIBUTION', amount: BigInt(500 * RUB), userId: 'u1', refId: 'c1' },
      { type: 'ORDER', amount: BigInt(-3000 * RUB), refId: 'o1' },
      { type: 'ADJUSTMENT', amount: BigInt(-100), userId: 'u2', comment: 'округление' },
    ]);

    const input = await loadCalcInput(db.client, '2026-07-05');

    expect(input.transactions).toHaveLength(1);
    expect(input.transactions?.[0]).toMatchObject({ type: 'ADJUSTMENT', amount: -100 });
  });

  it('переживает пустую базу без строки настроек', async () => {
    const db = createFakeDb();
    const input = await loadCalcInput(db.client, '2026-07-05');

    expect(input.fund).toEqual({ openingBalance: 0, startDate: null, defaultContribution: 50_000 });
    expect(input.participants).toEqual([]);
  });
});

describe('пересчёт', () => {
  it('воспроизводит пример §4.7 до копейки', async () => {
    const state = await loadFundState(seedSpecExample().client, '2026-07-05');

    expect(state.result.fundBalance).toBe(2000 * RUB);
    expect(state.balanceOf('u1')?.amount).toBe(425 * RUB);
    expect(state.balanceOf('u2')?.amount).toBe(225 * RUB);
    expect(state.invariant.isConsistent).toBe(true);
    expect(state.invariant.difference).toBe(0);
  });

  it('даёт доступ к раскладке заказа по его id', async () => {
    const state = await loadFundState(seedSpecExample().client, '2026-07-05');
    const period = state.periodOf('o1');

    expect(period?.totalPersonDays).toBe(7 * 30 + 15);
    expect(period?.isOpen).toBe(true);
    expect(state.periodOf('нет такого')).toBeNull();
  });

  it('расхождение инварианта пишется в лог уровня error, а не глотается', async () => {
    const db = seedSpecExample();
    // Начальные сальдо участников больше не сходятся с сальдо фонда (§4.2),
    // значит Σ балансов разойдётся с остатком — это всегда баг в коде.
    db.tables.user.update({ where: { id: 'u3' }, data: { openingBalance: BigInt(999 * RUB) } });

    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = await loadFundState(db.client, '2026-07-05');

    expect(state.invariant.isConsistent).toBe(false);
    expect(logged).toHaveBeenCalledOnce();
    expect(String(logged.mock.calls[0]?.[0])).toContain('Инвариант §5 нарушен');
  });
});

describe('помесячная сводка', () => {
  it('последний остаток совпадает с остатком фонда', async () => {
    const db = seedSpecExample();
    db.tables.waterOrder.seed([
      { id: 'o2', amount: BigInt(2400 * RUB), orderedAt: dateColumn('2026-07-06'), createdBy: 'u0' },
    ]);

    const state = await loadFundState(db.client, '2026-08-14');
    const stats = monthlyStats(state.input, state.result);

    expect(stats.map((stat) => stat.month)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(stats[0]).toEqual({
      month: '2026-06',
      contributions: 8 * 500 * RUB,
      orders: -3000 * RUB,
      endBalance: 2000 * RUB,
    });
    expect(stats[stats.length - 1]?.endBalance).toBe(state.result.fundBalance);
  });

  it('на пустом фонде без истории сводки нет', async () => {
    const state = await loadFundState(createFakeDb().client, '2026-08-14');
    expect(monthlyStats(state.input, state.result)).toEqual([]);
  });
});

describe('понедельная сводка', () => {
  it('идёт сплошными неделями с понедельника и сходится с остатком фонда', async () => {
    const db = seedSpecExample();
    db.tables.waterOrder.seed([
      { id: 'o2', amount: BigInt(2400 * RUB), orderedAt: dateColumn('2026-07-06'), createdBy: 'u0' },
    ]);

    const state = await loadFundState(db.client, '2026-08-14');
    const stats = fundFlowStats(state.input, state.result, startOfWeek, (key) => addDays(key, 7));

    // 01.06.2026 — понедельник; 10.08 — понедельник недели, в которую входит 14.08.
    expect(stats[0]?.start).toBe('2026-06-01');
    expect(stats[stats.length - 1]?.start).toBe('2026-08-10');
    expect(stats).toHaveLength(11);
    expect(stats.find((stat) => stat.start === '2026-07-06')?.orders).toBe(-2400 * RUB);
    expect(stats[stats.length - 1]?.endBalance).toBe(state.result.fundBalance);
  });
});
