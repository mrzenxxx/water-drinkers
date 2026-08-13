import { describe, expect, it } from 'vitest';

import { dateColumn } from '../support/fake-prisma';
import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice, START_DATE } from '../support/office';

/**
 * Приложение прозрачно: участник видит ровно то же, что администратор (§3).
 * Закрыты только рабочие инструменты модерации — очередь и журнал (§10.3).
 */
const READ_ONLY_QUERIES = [
  '{ fund { balance } }',
  '{ participants { id } }',
  '{ balances { amount } }',
  '{ contributions { id } }',
  '{ waterOrders { id } }',
  '{ absences { id } }',
];

const ADMIN_ONLY_QUERIES = ['{ pendingContributions { id } }', '{ auditLog { id } }'];

describe('права на чтение', () => {
  it('без входа не отдаётся ничего, кроме me', async () => {
    const db = seedOffice();

    for (const query of [...READ_ONLY_QUERIES, ...ADMIN_ONLY_QUERIES]) {
      const result = await run(query, { db: db.client });
      expect(errorCode(result), query).toBe('UNAUTHENTICATED');
    }

    const me = await runOk('{ me { id } }', { db: db.client });
    expect(me.me).toBeNull();
  });

  it('участнику открыто всё, кроме очереди и журнала', async () => {
    const db = seedOffice();

    for (const query of READ_ONLY_QUERIES) {
      const result = await run(query, { db: db.client, userId: 'u-0' });
      expect(result.errors, query).toBeUndefined();
    }

    for (const query of ADMIN_ONLY_QUERIES) {
      const result = await run(query, { db: db.client, userId: 'u-0' });
      expect(errorCode(result), query).toBe('FORBIDDEN');
    }
  });

  it('администратору открыто всё', async () => {
    const db = seedOffice();

    for (const query of [...READ_ONLY_QUERIES, ...ADMIN_ONLY_QUERIES]) {
      const result = await run(query, { db: db.client, userId: ADMIN_ID });
      expect(result.errors, query).toBeUndefined();
    }
  });
});

describe('состав участников', () => {
  it('по умолчанию без вышедших из состава', async () => {
    const db = seedOffice(2);
    db.tables.user.update({ where: { id: 'u-1' }, data: { leftAt: dateColumn('2026-07-01') } });

    const active = await runOk('{ participants { id isActive } }', {
      db: db.client,
      userId: ADMIN_ID,
    });
    expect((active.participants as { id: string }[]).map((row) => row.id)).toEqual([
      ADMIN_ID,
      'u-0',
    ]);

    const all = await runOk('{ participants(includeInactive: true) { id isActive leftAt } }', {
      db: db.client,
      userId: ADMIN_ID,
    });
    expect(all.participants).toHaveLength(3);
    expect(all.participants).toContainEqual({ id: 'u-1', isActive: false, leftAt: '2026-07-01' });
  });
});

describe('фонд', () => {
  it('отдаёт настройки, сходимость и помесячную сводку', async () => {
    const db = seedOffice(1);

    db.tables.contribution.seed([
      {
        userId: 'u-0',
        amount: 50_000n,
        paidAt: dateColumn('2026-06-10'),
        status: 'CONFIRMED',
        reviewedBy: ADMIN_ID,
      },
    ]);
    db.tables.waterOrder.seed([
      { amount: 30_000n, orderedAt: dateColumn('2026-06-05'), createdBy: ADMIN_ID },
    ]);

    const data = await runOk(
      `{
        fund {
          balance
          openingBalance
          startDate
          defaultContribution
          balancesSum
          isConsistent
          monthlyStats { month contributions orders endBalance }
        }
      }`,
      { db: db.client, userId: 'u-0', asOf: '2026-07-01' },
    );

    expect(data.fund).toMatchObject({
      balance: 20_000,
      openingBalance: 0,
      startDate: START_DATE,
      defaultContribution: 50_000,
      balancesSum: 20_000,
      isConsistent: true,
    });
    expect(data.fund).toHaveProperty('monthlyStats', [
      { month: '2026-06', contributions: 50_000, orders: -30_000, endBalance: 20_000 },
      { month: '2026-07', contributions: 0, orders: 0, endBalance: 20_000 },
    ]);
  });

  it('раскрывает баланс построчно (§6.4)', async () => {
    const db = seedOffice(1);
    db.tables.contribution.seed([
      {
        userId: 'u-0',
        amount: 50_000n,
        paidAt: dateColumn('2026-06-10'),
        status: 'CONFIRMED',
        reviewedBy: ADMIN_ID,
      },
    ]);
    db.tables.waterOrder.seed([
      { id: 'o1', amount: 30_000n, orderedAt: dateColumn('2026-06-05'), createdBy: ADMIN_ID },
    ]);

    const data = await runOk(
      `{
        me {
          balance {
            amount
            owes
            breakdown {
              openingBalance
              contributionsTotal
              expensesTotal
              settlementsTotal
              adjustmentsTotal
              orderShares { daysPresent totalPersonDays share order { id orderedAt } }
            }
          }
        }
      }`,
      { db: db.client, userId: 'u-0', asOf: '2026-07-01' },
    );

    const balance = (data.me as { balance: Record<string, unknown> }).balance;
    expect(balance).toMatchObject({ amount: 35_000, owes: false });
    expect(balance.breakdown).toMatchObject({
      openingBalance: 0,
      contributionsTotal: 50_000,
      expensesTotal: 15_000,
      settlementsTotal: 0,
      adjustmentsTotal: 0,
    });
    expect((balance.breakdown as { orderShares: unknown[] }).orderShares).toEqual([
      { daysPresent: 26, totalPersonDays: 52, share: 15_000, order: { id: 'o1', orderedAt: '2026-06-05' } },
    ]);
  });
});

describe('фильтры выборок', () => {
  it('взносы фильтруются по участнику, статусу и датам', async () => {
    const db = seedOffice(1);
    db.tables.contribution.seed([
      { id: 'c1', userId: 'u-0', amount: 50_000n, paidAt: dateColumn('2026-06-10'), status: 'CONFIRMED' },
      { id: 'c2', userId: 'u-0', amount: 50_000n, paidAt: dateColumn('2026-07-10'), status: 'PENDING' },
      { id: 'c3', userId: ADMIN_ID, amount: 50_000n, paidAt: dateColumn('2026-06-11'), status: 'CONFIRMED' },
    ]);

    const byUser = await runOk('query ($id: ID!) { contributions(userId: $id) { id } }', {
      db: db.client,
      userId: 'u-0',
      variables: { id: 'u-0' },
    });
    expect(byUser.contributions).toEqual([{ id: 'c2' }, { id: 'c1' }]);

    const byStatus = await runOk('{ contributions(status: PENDING) { id } }', {
      db: db.client,
      userId: 'u-0',
    });
    expect(byStatus.contributions).toEqual([{ id: 'c2' }]);

    const byDates = await runOk('{ contributions(from: "2026-06-01", to: "2026-06-30") { id } }', {
      db: db.client,
      userId: 'u-0',
    });
    expect(byDates.contributions).toEqual([{ id: 'c3' }, { id: 'c1' }]);
  });

  it('в календарь попадают отсутствия, пересекающие отрезок', async () => {
    const db = seedOffice(1);
    db.tables.absence.seed([
      { id: 'a1', userId: 'u-0', type: 'VACATION', startsOn: dateColumn('2026-05-25'), endsOn: dateColumn('2026-06-05') },
      { id: 'a2', userId: 'u-0', type: 'SICK_LEAVE', startsOn: dateColumn('2026-07-10'), endsOn: dateColumn('2026-07-12') },
    ]);

    // Отпуск начался в мае и продолжается в июне — календарь июня обязан его показать.
    const june = await runOk('{ absences(from: "2026-06-01", to: "2026-06-30") { id } }', {
      db: db.client,
      userId: 'u-0',
    });
    expect(june.absences).toEqual([{ id: 'a1' }]);

    const sick = await runOk('{ absences(type: SICK_LEAVE) { id } }', {
      db: db.client,
      userId: 'u-0',
    });
    expect(sick.absences).toEqual([{ id: 'a2' }]);
  });

  it('дата не в том формате отвергается кодом, а не пятисоткой', async () => {
    const db = seedOffice();
    const result = await run('{ waterOrders(from: "01.06.2026") { id } }', {
      db: db.client,
      userId: 'u-0',
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });
});
