import { describe, expect, it } from 'vitest';

import { dateColumn, type FakeDb } from '../support/fake-prisma';
import { runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

/**
 * Проблема N+1 (§10.1) — учебная цель проекта, поэтому она проверяется счётом
 * запросов, а не на глаз. Считаются вызовы `findMany`: именно они уходят
 * в базу, и именно их DataLoader обязан схлопнуть в один на весь список.
 */

type Call = { table: string; args: Record<string, unknown> };

function recordQueries(db: FakeDb): Call[] {
  const calls: Call[] = [];
  const client = db.client as unknown as Record<
    string,
    { findMany(args?: Record<string, unknown>): Promise<unknown[]> }
  >;

  for (const table of ['user', 'absence', 'contribution', 'waterOrder', 'receipt']) {
    const delegate = client[table] as { findMany(args?: Record<string, unknown>): Promise<unknown[]> };
    const original = delegate.findMany.bind(delegate);
    delegate.findMany = async (args?: Record<string, unknown>) => {
      calls.push({ table, args: args ?? {} });
      return original(args);
    };
  }

  return calls;
}

function idsIn(call: Call | undefined): string[] {
  const where = call?.args.where as { id?: { in?: string[] } } | undefined;
  return where?.id?.in ?? [];
}

function seedContributionsFromEveryone(count: number): FakeDb & { participantIds: string[] } {
  const db = seedOffice(count);

  for (const [index, userId] of db.participantIds.entries()) {
    db.tables.contribution.seed([
      {
        id: `c${index}`,
        userId,
        amount: 50_000n,
        paidAt: dateColumn('2026-06-10'),
        status: 'CONFIRMED',
        reviewedBy: ADMIN_ID,
      },
    ]);
  }

  return db;
}

describe('DataLoader', () => {
  it('восемь взносов восьми участников читают участников одним запросом', async () => {
    const db = seedContributionsFromEveryone(8);
    const calls = recordQueries(db);

    const data = await runOk('{ contributions { id user { id firstName } } }', {
      db: db.client,
      // Смотрит администратор, а он среди авторов не числится: иначе его
      // строка уже лежала бы в кеше лоадера и батч был бы на одного меньше.
      userId: ADMIN_ID,
    });
    expect(data.contributions).toHaveLength(8);

    const userQueries = calls.filter((call) => call.table === 'user');
    // Первый запрос — проверка прав (`requireUser`), второй — батч на всех
    // авторов сразу. Без DataLoader их было бы девять.
    expect(userQueries).toHaveLength(2);
    expect(idsIn(userQueries[0])).toEqual([ADMIN_ID]);
    expect(idsIn(userQueries[1])).toHaveLength(8);
  });

  it('связи участников читаются по одному запросу на связь, а не на участника', async () => {
    const db = seedContributionsFromEveryone(8);
    for (const [index, userId] of db.participantIds.entries()) {
      db.tables.absence.seed([
        {
          userId,
          type: 'VACATION',
          startsOn: dateColumn(`2026-06-${String(index + 1).padStart(2, '0')}`),
          endsOn: dateColumn(`2026-06-${String(index + 1).padStart(2, '0')}`),
        },
      ]);
    }

    const calls = recordQueries(db);
    const data = await runOk(
      '{ participants { id absences { id } contributions { id } } }',
      { db: db.client, userId: ADMIN_ID },
    );
    expect(data.participants).toHaveLength(9);

    // Девять участников, но по одному запросу на каждую связь.
    expect(calls.filter((call) => call.table === 'absence')).toHaveLength(1);
    expect(calls.filter((call) => call.table === 'contribution')).toHaveLength(1);
  });

  it('один и тот же участник в разных местах ответа читается один раз', async () => {
    const db = seedContributionsFromEveryone(1);
    const calls = recordQueries(db);

    await runOk(
      `{
        me { id }
        contributions { user { id } reviewedBy { id } }
        balances { user { id } }
      }`,
      { db: db.client, userId: ADMIN_ID },
    );

    // Кеш лоадера живёт в пределах запроса: администратор попадает и в `me`,
    // и в `reviewedBy`, и в `balances`, но читается один раз.
    const requested = calls
      .filter((call) => call.table === 'user')
      .flatMap((call) => idsIn(call));
    expect(requested.filter((id) => id === ADMIN_ID)).toHaveLength(1);
  });

  it('пересчёт за один запрос выполняется один раз, а не на каждое поле', async () => {
    const db = seedContributionsFromEveryone(3);
    const calls = recordQueries(db);

    await runOk(
      '{ fund { balance balancesSum isConsistent } balances { amount } me { balance { amount } } }',
      { db: db.client, userId: ADMIN_ID },
    );

    // `loadCalcInput` читает заказы ровно один раз за пересчёт — значит и
    // пересчёт был один, хотя баланс спрошен тремя разными полями.
    expect(calls.filter((call) => call.table === 'waterOrder')).toHaveLength(1);
  });
});
