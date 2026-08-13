import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice, START_DATE } from '../support/office';

/**
 * Админ-панель §6.7 на подставной базе.
 *
 * Живой PostgreSQL на машине разработки недоступен, поэтому проверяется то, что
 * от базы не зависит и при этом ломается тише всего: права по ролям, знак суммы
 * выплаты, сходимость стартового состояния (§4.2) и инвариант §5 после каждой
 * админской мутации.
 */

const ASOF = '2026-07-01';

const ADD_PARTICIPANT = `
  mutation ($email: String!, $joinedAt: Date!, $openingBalance: Money) {
    addParticipant(email: $email, joinedAt: $joinedAt, openingBalance: $openingBalance) {
      id email role joinedAt leftAt isActive openingBalance
    }
  }
`;

const DEACTIVATE = `mutation ($id: ID!, $leftAt: Date!) { deactivateParticipant(id: $id, leftAt: $leftAt) { id leftAt isActive } }`;
const REACTIVATE = `mutation ($id: ID!) { reactivateParticipant(id: $id) { id leftAt isActive } }`;
const SET_ROLE = `mutation ($id: ID!, $role: Role!) { setParticipantRole(id: $id, role: $role) { id role } }`;
const SETTLE = `mutation ($id: ID!, $amount: Money!, $note: String!) { settleParticipant(id: $id, amount: $amount, note: $note) { id } }`;
const ADJUST = `mutation ($userId: ID, $amount: Money!, $comment: String!) { createAdjustment(userId: $userId, amount: $amount, comment: $comment) { balance } }`;

const SET_OPENING = `
  mutation ($input: OpeningBalancesInput!) {
    setOpeningBalances(input: $input) { openingBalance startDate }
  }
`;

const CONTRIBUTION_FOR = `
  mutation ($input: ContributionForInput!) {
    addContributionFor(input: $input) { id status amount paidAt user { id } }
  }
`;

const ABSENCE_FOR = `
  mutation ($input: AbsenceForInput!) {
    addAbsenceFor(input: $input) { id type startsOn endsOn user { id } }
  }
`;

const CHECK = `
  query {
    fund { balance balancesSum isConsistent openingBalance }
    balances { user { id } amount }
  }
`;

type Check = {
  fund: { balance: number; balancesSum: number; isConsistent: boolean; openingBalance: number };
  balances: { user: { id: string }; amount: number }[];
};

/** Инвариант §5 плюс сходимость с суммой, посчитанной в самом тесте. */
async function expectConsistent(db: ReturnType<typeof seedOffice>, hint: string): Promise<Check> {
  const check = (await runOk(CHECK, {
    db: db.client,
    userId: ADMIN_ID,
    asOf: ASOF,
  })) as unknown as Check;

  const sum = check.balances.reduce((total, balance) => total + balance.amount, 0);
  expect(check.fund.isConsistent, hint).toBe(true);
  expect(sum, `${hint}: Σ балансов`).toBe(check.fund.balance);
  expect(check.fund.balancesSum, hint).toBe(check.fund.balance);

  return check;
}

describe('права на админские мутации (§3)', () => {
  const cases: { name: string; query: string; variables: Record<string, unknown> }[] = [
    {
      name: 'addParticipant',
      query: ADD_PARTICIPANT,
      variables: { email: 'new@sspk.spb.ru', joinedAt: START_DATE },
    },
    { name: 'deactivateParticipant', query: DEACTIVATE, variables: { id: 'u-1', leftAt: '2026-07-01' } },
    { name: 'reactivateParticipant', query: REACTIVATE, variables: { id: 'u-1' } },
    { name: 'setParticipantRole', query: SET_ROLE, variables: { id: 'u-1', role: 'ADMIN' } },
    { name: 'settleParticipant', query: SETTLE, variables: { id: 'u-1', amount: -100, note: 'возврат' } },
    { name: 'createAdjustment', query: ADJUST, variables: { userId: null, amount: 100, comment: 'нашлись' } },
    {
      name: 'setOpeningBalances',
      query: SET_OPENING,
      variables: { input: { startDate: START_DATE, fundOpeningBalance: 0, openingBalances: [] } },
    },
    {
      name: 'addContributionFor',
      query: CONTRIBUTION_FOR,
      variables: { input: { userId: 'u-1', amount: 50_000, paidAt: '2026-06-10' } },
    },
    {
      name: 'addAbsenceFor',
      query: ABSENCE_FOR,
      variables: {
        input: { userId: 'u-1', type: 'VACATION', startsOn: '2026-06-10', endsOn: '2026-06-12' },
      },
    },
  ];

  it.each(cases)('$name недоступна участнику и гостю', async ({ query, variables }) => {
    const db = seedOffice();

    const asParticipant = await run(query, { db: db.client, userId: 'u-0', asOf: ASOF, variables });
    expect(errorCode(asParticipant)).toBe('FORBIDDEN');

    const asGuest = await run(query, { db: db.client, asOf: ASOF, variables });
    expect(errorCode(asGuest)).toBe('UNAUTHENTICATED');

    // Отвергнутая мутация не оставляет следов ни в деньгах, ни в журнале.
    expect(db.tables.fundTransaction.rows).toHaveLength(0);
    expect(db.tables.auditEntry.rows).toHaveLength(0);
  });
});

describe('состав участников (§6.7)', () => {
  it('заводится по адресу и дате, без имени и фамилии', async () => {
    const db = seedOffice();

    const data = await runOk(ADD_PARTICIPANT, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { email: 'I.Ivanov@SSPK.spb.ru', joinedAt: '2026-06-15' },
    });

    expect(data.addParticipant).toMatchObject({
      email: 'i.ivanov@sspk.spb.ru',
      role: 'PARTICIPANT',
      joinedAt: '2026-06-15',
      leftAt: null,
      isActive: true,
      openingBalance: 0,
    });

    const created = db.tables.user.rows.find((row) => row.email === 'i.ivanov@sspk.spb.ru');
    expect(created).toMatchObject({ firstName: null, lastName: null });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual(['participant.add']);
  });

  it('чужой домен и повторный адрес отвергаются', async () => {
    const db = seedOffice();

    const foreign = await run(ADD_PARTICIPANT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { email: 'someone@gmail.com', joinedAt: START_DATE },
    });
    expect(errorCode(foreign)).toBe('BAD_USER_INPUT');

    const duplicate = await run(ADD_PARTICIPANT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { email: 'p0@sspk.spb.ru', joinedAt: START_DATE },
    });
    expect(errorCode(duplicate)).toBe('CONFLICT');
  });

  it('начальное сальдо участника поднимает и начальное сальдо фонда (§4.2)', async () => {
    const db = seedOffice();

    await runOk(ADD_PARTICIPANT, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { email: 'new@sspk.spb.ru', joinedAt: '2026-06-15', openingBalance: 12_500 },
    });

    const check = await expectConsistent(db, 'после добавления с сальдо');
    expect(check.fund.openingBalance).toBe(12_500);
    expect(check.balances.find((balance) => balance.user.id !== ADMIN_ID && balance.amount === 12_500)).toBeDefined();
  });

  it('исключение проставляет дату, повтор — CONFLICT, возврат снимает', async () => {
    const db = seedOffice();

    const left = await runOk(DEACTIVATE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0', leftAt: '2026-06-20' },
    });
    expect(left.deactivateParticipant).toMatchObject({ leftAt: '2026-06-20', isActive: false });

    const again = await run(DEACTIVATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', leftAt: '2026-06-21' },
    });
    expect(errorCode(again)).toBe('CONFLICT');

    const back = await runOk(REACTIVATE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0' },
    });
    expect(back.reactivateParticipant).toMatchObject({ leftAt: null, isActive: true });

    // Строка участника на месте: физического удаления нет (§6.7).
    expect(db.tables.user.rows).toHaveLength(4);
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'participant.deactivate',
      'participant.reactivate',
    ]);
  });

  it('дата выхода раньше даты вступления не принимается', async () => {
    const db = seedOffice();
    const result = await run(DEACTIVATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', leftAt: '2026-05-01' },
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });
});

describe('роли (§6.7)', () => {
  it('последнего администратора нельзя ни разжаловать, ни исключить', async () => {
    const db = seedOffice();

    const demoted = await run(SET_ROLE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: ADMIN_ID, role: 'PARTICIPANT' },
    });
    expect(errorCode(demoted)).toBe('CONFLICT');

    const excluded = await run(DEACTIVATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: ADMIN_ID, leftAt: '2026-07-01' },
    });
    expect(errorCode(excluded)).toBe('CONFLICT');

    expect(db.tables.user.rows.find((row) => row.id === ADMIN_ID)).toMatchObject({
      role: 'ADMIN',
      leftAt: null,
    });
  });

  it('второго администратора назначить можно, после этого первого — разжаловать', async () => {
    const db = seedOffice();

    const promoted = await runOk(SET_ROLE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: 'u-0', role: 'ADMIN' },
    });
    expect(promoted.setParticipantRole).toMatchObject({ id: 'u-0', role: 'ADMIN' });

    const demoted = await runOk(SET_ROLE, {
      db: db.client,
      userId: 'u-0',
      variables: { id: ADMIN_ID, role: 'PARTICIPANT' },
    });
    expect(demoted.setParticipantRole).toMatchObject({ id: ADMIN_ID, role: 'PARTICIPANT' });

    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'participant.role',
      'participant.role',
    ]);
  });

  it('вышедший администратор последним не считается', async () => {
    const db = seedOffice();
    db.tables.user.seed([
      {
        id: 'u-gone',
        email: 'gone@sspk.spb.ru',
        role: 'ADMIN',
        joinedAt: new Date('2026-06-01T00:00:00.000Z'),
        leftAt: new Date('2026-06-30T00:00:00.000Z'),
      },
    ]);

    const result = await run(SET_ROLE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: ADMIN_ID, role: 'PARTICIPANT' },
    });
    expect(errorCode(result)).toBe('CONFLICT');
  });
});

describe('стартовое состояние фонда (§4.2)', () => {
  it('не сохраняется, пока сальдо не сходятся, и показывает расхождение', async () => {
    const db = seedOffice();

    const result = await run(SET_OPENING, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        input: {
          startDate: START_DATE,
          fundOpeningBalance: 100_000,
          openingBalances: [
            { userId: 'u-0', amount: 30_000 },
            { userId: 'u-1', amount: 30_000 },
          ],
        },
      },
    });

    expect(errorCode(result)).toBe('BAD_USER_INPUT');
    expect(result.errors?.[0]?.extensions).toMatchObject({ difference: -40_000 });

    // Ничего не записано: ни настройки фонда, ни сальдо участников.
    expect(db.tables.fundSettings.rows[0]).toMatchObject({ openingBalance: 0n });
    expect(db.tables.user.rows.every((row) => row.openingBalance === 0n)).toBe(true);
  });

  it('сходящиеся сальдо сохраняются вместе с датой начала учёта', async () => {
    const db = seedOffice();

    const data = await runOk(SET_OPENING, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: {
        input: {
          startDate: '2026-06-01',
          fundOpeningBalance: 100_000,
          openingBalances: [
            { userId: 'u-0', amount: 40_000 },
            { userId: 'u-1', amount: 30_000 },
            { userId: 'u-2', amount: 30_000 },
          ],
        },
      },
    });

    expect(data.setOpeningBalances).toMatchObject({
      openingBalance: 100_000,
      startDate: '2026-06-01',
    });

    const check = await expectConsistent(db, 'после стартового состояния');
    expect(check.balances.find((balance) => balance.user.id === 'u-0')?.amount).toBe(40_000);
    // Администратор в списке не назван — значит, его сальдо ноль, а не старое.
    expect(check.balances.find((balance) => balance.user.id === ADMIN_ID)?.amount).toBe(0);
  });

  it('«распределить поровну» делит по методу наибольших остатков и метит журнал', async () => {
    const db = seedOffice();

    await runOk(SET_OPENING, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: {
        input: {
          startDate: START_DATE,
          fundOpeningBalance: 100_001,
          openingBalances: [],
          equalSplit: true,
        },
      },
    });

    const check = await expectConsistent(db, 'после равного деления');
    const amounts = check.balances.map((balance) => balance.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([25_000, 25_000, 25_000, 25_001]);

    const entry = db.tables.auditEntry.rows.at(-1) as { action: string; after: { mode: string } };
    expect(entry.action).toBe('fund.opening');
    expect(entry.after.mode).toBe('equal-split');
  });
});

describe('выплата остатка (§6.7)', () => {
  async function withBalance(): Promise<ReturnType<typeof seedOffice>> {
    const db = seedOffice();
    await runOk(SET_OPENING, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: {
        input: {
          startDate: START_DATE,
          fundOpeningBalance: 60_000,
          openingBalances: [{ userId: 'u-0', amount: 60_000 }],
        },
      },
    });
    return db;
  }

  it('положительная сумма отвергается: выплата уносит деньги из фонда (§4.5)', async () => {
    const db = await withBalance();

    const positive = await run(SETTLE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0', amount: 60_000, note: 'вернули' },
    });
    expect(errorCode(positive)).toBe('BAD_USER_INPUT');

    const zero = await run(SETTLE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0', amount: 0, note: 'вернули' },
    });
    expect(errorCode(zero)).toBe('BAD_USER_INPUT');

    expect(db.tables.fundTransaction.rows).toHaveLength(0);
  });

  it('больше остатка выплатить нельзя', async () => {
    const db = await withBalance();

    const result = await run(SETTLE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0', amount: -60_001, note: 'вернули' },
    });
    expect(errorCode(result)).toBe('CONFLICT');
    expect(db.tables.fundTransaction.rows).toHaveLength(0);
  });

  it('пишет отрицательную операцию SETTLEMENT и не рушит инвариант', async () => {
    const db = await withBalance();

    await runOk(SETTLE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id: 'u-0', amount: -60_000, note: 'вернули при выходе' },
    });

    expect(db.tables.fundTransaction.rows).toHaveLength(1);
    expect(db.tables.fundTransaction.rows[0]).toMatchObject({
      type: 'SETTLEMENT',
      amount: -60_000n,
      userId: 'u-0',
      createdBy: ADMIN_ID,
    });

    const check = await expectConsistent(db, 'после выплаты');
    expect(check.fund.balance).toBe(0);
    expect(check.balances.find((balance) => balance.user.id === 'u-0')?.amount).toBe(0);
  });
});

describe('корректировки (§2.4)', () => {
  it('требуют комментария и ненулевой суммы', async () => {
    const db = seedOffice();

    const empty = await run(ADJUST, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { userId: 'u-0', amount: 10_000, comment: '   ' },
    });
    expect(errorCode(empty)).toBe('BAD_USER_INPUT');

    const zero = await run(ADJUST, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { userId: 'u-0', amount: 0, comment: 'ошибка' },
    });
    expect(errorCode(zero)).toBe('BAD_USER_INPUT');

    expect(db.tables.fundTransaction.rows).toHaveLength(0);
  });

  it('с участником уходит ему одному', async () => {
    const db = seedOffice();

    await runOk(ADJUST, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { userId: 'u-0', amount: -50_000, comment: 'подтверждён взнос, которого не было' },
    });

    const check = await expectConsistent(db, 'после адресной корректировки');
    expect(check.balances.find((balance) => balance.user.id === 'u-0')?.amount).toBe(-50_000);
    expect(check.balances.find((balance) => balance.user.id === 'u-1')?.amount).toBe(0);
  });

  it('без участника делится поровну между активными (§2.4)', async () => {
    const db = seedOffice();

    await runOk(ADJUST, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { userId: null, amount: 100, comment: 'нашлись деньги неизвестного происхождения' },
    });

    const check = await expectConsistent(db, 'после корректировки без участника');
    expect(check.fund.balance).toBe(100);
    expect(check.balances.map((balance) => balance.amount).sort((a, b) => a - b)).toEqual([25, 25, 25, 25]);
  });
});

describe('ввод за участника (§6.7)', () => {
  it('взнос создаётся PENDING, помечен и всё равно проходит подтверждение', async () => {
    const db = seedOffice();

    const data = await runOk(CONTRIBUTION_FOR, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { input: { userId: 'u-0', amount: 50_000, paidAt: '2026-06-10' } },
    });

    expect(data.addContributionFor).toMatchObject({
      status: 'PENDING',
      amount: 50_000,
      paidAt: '2026-06-10',
      user: { id: 'u-0' },
    });
    expect(db.tables.contribution.rows[0]).toMatchObject({ enteredByAdmin: true, status: 'PENDING' });

    // Правило 6: до подтверждения денег нет.
    expect(db.tables.fundTransaction.rows).toHaveLength(0);
    const before = await expectConsistent(db, 'до подтверждения');
    expect(before.fund.balance).toBe(0);

    const id = (data.addContributionFor as { id: string }).id;
    await runOk(`mutation ($id: ID!) { confirmContribution(id: $id) { id status } }`, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: { id },
    });

    const after = await expectConsistent(db, 'после подтверждения');
    expect(after.fund.balance).toBe(50_000);

    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'contribution.submit.for',
      'contribution.confirm',
    ]);
  });

  it('отсутствие помечается и не пересекается с уже отмеченным', async () => {
    const db = seedOffice();

    const data = await runOk(ABSENCE_FOR, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: {
        input: { userId: 'u-0', type: 'SICK_LEAVE', startsOn: '2026-06-10', endsOn: '2026-06-14' },
      },
    });
    expect(data.addAbsenceFor).toMatchObject({ type: 'SICK_LEAVE', user: { id: 'u-0' } });
    expect(db.tables.absence.rows[0]).toMatchObject({ enteredByAdmin: true });

    const overlapping = await run(ABSENCE_FOR, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        input: { userId: 'u-0', type: 'VACATION', startsOn: '2026-06-12', endsOn: '2026-06-20' },
      },
    });
    expect(errorCode(overlapping)).toBe('ABSENCE_OVERLAP');
    expect(db.tables.absence.rows).toHaveLength(1);

    // У другого участника те же даты — не пересечение.
    await runOk(ABSENCE_FOR, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: ASOF,
      variables: {
        input: { userId: 'u-1', type: 'VACATION', startsOn: '2026-06-12', endsOn: '2026-06-20' },
      },
    });
    expect(db.tables.absence.rows).toHaveLength(2);
  });

  it('несуществующий участник — NOT_FOUND', async () => {
    const db = seedOffice();
    const result = await run(CONTRIBUTION_FOR, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { userId: 'нет такого', amount: 50_000, paidAt: '2026-06-10' } },
    });
    expect(errorCode(result)).toBe('NOT_FOUND');
  });
});

describe('инвариант §5 после каждой админской мутации', () => {
  it('держится на всей цепочке действий администратора', async () => {
    const db = seedOffice();
    const steps: [string, Record<string, unknown>][] = [
      [
        SET_OPENING,
        {
          input: {
            startDate: START_DATE,
            fundOpeningBalance: 90_000,
            openingBalances: [
              { userId: 'u-0', amount: 30_000 },
              { userId: 'u-1', amount: 30_000 },
              { userId: 'u-2', amount: 30_000 },
            ],
          },
        },
      ],
      [ADD_PARTICIPANT, { email: 'new@sspk.spb.ru', joinedAt: '2026-06-10', openingBalance: 10_000 }],
      [CONTRIBUTION_FOR, { input: { userId: 'u-0', amount: 50_000, paidAt: '2026-06-11' } }],
      [ADJUST, { userId: null, amount: 333, comment: 'неизвестные деньги' }],
      [ADJUST, { userId: 'u-1', amount: -1_000, comment: 'лишний взнос' }],
      [ABSENCE_FOR, { input: { userId: 'u-2', type: 'VACATION', startsOn: '2026-06-12', endsOn: '2026-06-20' } }],
      [SETTLE, { id: 'u-0', amount: -1_000, note: 'сдача' }],
      [DEACTIVATE, { id: 'u-2', leftAt: '2026-06-25' }],
      [REACTIVATE, { id: 'u-2' }],
      [SET_ROLE, { id: 'u-1', role: 'ADMIN' }],
    ];

    for (const [index, [query, variables]] of steps.entries()) {
      const result = await run(query, { db: db.client, userId: ADMIN_ID, asOf: ASOF, variables });
      expect(result.errors, `шаг ${index}: ${JSON.stringify(result.errors)}`).toBeUndefined();
      await expectConsistent(db, `шаг ${index}`);
    }
  });
});
