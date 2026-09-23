import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

const SUBMIT = `
  mutation ($amount: Money!, $paidAt: Date!) {
    submitContribution(amount: $amount, paidAt: $paidAt) {
      id
      status
      amount
      paidAt
      needsAttention
      user { id }
    }
  }
`;

const CONFIRM = `
  mutation ($id: ID!) {
    confirmContribution(id: $id) { id status reviewedBy { id } reviewedAt }
  }
`;

const REJECT = `
  mutation ($id: ID!, $comment: String!) {
    rejectContribution(id: $id, comment: $comment) { id status reviewComment }
  }
`;

const MONEY = `
  query {
    fund { balance balancesSum isConsistent }
    me { balance { amount owes } }
  }
`;

async function submit(db: ReturnType<typeof seedOffice>, userId: string, amount = 50_000) {
  const data = await runOk(SUBMIT, {
    db: db.client,
    userId,
    asOf: '2026-07-01',
    variables: { amount, paidAt: '2026-06-10' },
  });
  return (data.submitContribution as { id: string }).id;
}

describe('подача взноса', () => {
  it('требует входа', async () => {
    const db = seedOffice();
    const result = await run(SUBMIT, {
      db: db.client,
      variables: { amount: 50_000, paidAt: '2026-06-10' },
    });
    expect(errorCode(result)).toBe('UNAUTHENTICATED');
  });

  it('создаётся в статусе PENDING и от имени подавшего', async () => {
    const db = seedOffice();
    const data = await runOk(SUBMIT, {
      db: db.client,
      userId: 'u-0',
      variables: { amount: 50_000, paidAt: '2026-06-10' },
    });

    expect(data.submitContribution).toMatchObject({
      status: 'PENDING',
      amount: 50_000,
      paidAt: '2026-06-10',
      needsAttention: false,
      user: { id: 'u-0' },
    });
  });

  it('не пропускает ноль, минус и дату не в том формате', async () => {
    const db = seedOffice();

    for (const amount of [0, -50_000]) {
      const result = await run(SUBMIT, {
        db: db.client,
        userId: 'u-0',
        variables: { amount, paidAt: '2026-06-10' },
      });
      expect(errorCode(result), `сумма ${amount}`).toBe('BAD_USER_INPUT');
    }

    const badDate = await run(SUBMIT, {
      db: db.client,
      userId: 'u-0',
      variables: { amount: 50_000, paidAt: '10.06.2026' },
    });
    expect(errorCode(badDate)).toBe('BAD_USER_INPUT');
  });

  it('в журнал операций до подтверждения ничего не пишет (правило 6)', async () => {
    const db = seedOffice();
    await submit(db, 'u-0');

    expect(db.tables.fundTransaction.rows).toHaveLength(0);
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual(['contribution.submit']);
  });
});

describe('один взнос на рассмотрении (§6.2)', () => {
  it('второй не регистрируется, пока первый ждёт подтверждения', async () => {
    const db = seedOffice();
    const first = await submit(db, 'u-0');

    const again = await run(SUBMIT, {
      db: db.client,
      userId: 'u-0',
      variables: { amount: 30_000, paidAt: '2026-06-11' },
    });
    expect(errorCode(again)).toBe('CONFLICT');
    expect(again.errors?.[0]?.extensions?.pendingId).toBe(first);
    expect(db.tables.contribution.rows).toHaveLength(1);
    expect(db.tables.auditEntry.rows).toHaveLength(1);
  });

  it('чужой взнос на рассмотрении не мешает', async () => {
    const db = seedOffice();
    await submit(db, 'u-0');
    await submit(db, 'u-1');
    expect(db.tables.contribution.rows).toHaveLength(2);
  });

  it('после подтверждения или отказа можно зарегистрировать следующий', async () => {
    const db = seedOffice();
    const first = await submit(db, 'u-0');
    await runOk(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id: first } });

    const second = await submit(db, 'u-0');
    await runOk(REJECT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: second, comment: 'Не пришло' },
    });

    await submit(db, 'u-0');
    expect(db.tables.contribution.rows).toHaveLength(3);
  });
});

describe('модерация взноса', () => {
  it('участник подтвердить не может, администратор может', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');

    const asParticipant = await run(CONFIRM, { db: db.client, userId: 'u-1', variables: { id } });
    expect(errorCode(asParticipant)).toBe('FORBIDDEN');

    // И даже автор взноса не подтверждает сам себя.
    const asAuthor = await run(CONFIRM, { db: db.client, userId: 'u-0', variables: { id } });
    expect(errorCode(asAuthor)).toBe('FORBIDDEN');

    const asAdmin = await runOk(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });
    expect(asAdmin.confirmContribution).toMatchObject({
      status: 'CONFIRMED',
      reviewedBy: { id: ADMIN_ID },
    });
  });

  it('баланс меняется только после подтверждения (правило 6)', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');

    const pending = await runOk(MONEY, { db: db.client, userId: 'u-0', asOf: '2026-07-01' });
    expect(pending.fund).toMatchObject({ balance: 0, balancesSum: 0, isConsistent: true });
    expect(pending.me).toMatchObject({ balance: { amount: 0, owes: false } });

    await runOk(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });

    const confirmed = await runOk(MONEY, { db: db.client, userId: 'u-0', asOf: '2026-07-01' });
    expect(confirmed.fund).toMatchObject({
      balance: 50_000,
      balancesSum: 50_000,
      isConsistent: true,
    });
    expect(confirmed.me).toMatchObject({ balance: { amount: 50_000, owes: false } });
  });

  it('подтверждение пишет операцию и запись аудита одной транзакцией', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');
    await runOk(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });

    expect(db.tables.fundTransaction.rows).toHaveLength(1);
    expect(db.tables.fundTransaction.rows[0]).toMatchObject({
      type: 'CONTRIBUTION',
      amount: 50_000n,
      userId: 'u-0',
      refId: id,
      createdBy: ADMIN_ID,
    });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'contribution.submit',
      'contribution.confirm',
    ]);
  });

  it('дважды не подтверждается: журнал неизменяем, ошибка гасится корректировкой', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');
    await runOk(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });

    const again = await run(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });
    expect(errorCode(again)).toBe('CONFLICT');
    // Ни второй операции, ни второй записи аудита — откат сработал целиком.
    expect(db.tables.fundTransaction.rows).toHaveLength(1);
    expect(db.tables.auditEntry.rows).toHaveLength(2);
  });

  it('отклонение требует комментария и денег не двигает', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');

    const empty = await run(REJECT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, comment: '   ' },
    });
    expect(errorCode(empty)).toBe('BAD_USER_INPUT');

    const rejected = await runOk(REJECT, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, comment: 'Чек не читается' },
    });
    expect(rejected.rejectContribution).toMatchObject({
      status: 'REJECTED',
      reviewComment: 'Чек не читается',
    });

    expect(db.tables.fundTransaction.rows).toHaveLength(0);

    const money = await runOk(MONEY, { db: db.client, userId: 'u-0', asOf: '2026-07-01' });
    expect(money.fund).toMatchObject({ balance: 0, isConsistent: true });
  });

  it('отклонённый взнос повторно не рассматривается', async () => {
    const db = seedOffice();
    const id = await submit(db, 'u-0');
    await runOk(REJECT, { db: db.client, userId: ADMIN_ID, variables: { id, comment: 'нет чека' } });

    const result = await run(CONFIRM, { db: db.client, userId: ADMIN_ID, variables: { id } });
    expect(errorCode(result)).toBe('CONFLICT');
  });

  it('несуществующий взнос — NOT_FOUND, а не пятисотка', async () => {
    const db = seedOffice();
    const result = await run(CONFIRM, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: '00000000-0000-4000-8000-000000009999' },
    });
    expect(errorCode(result)).toBe('NOT_FOUND');
  });
});

describe('очередь подтверждений', () => {
  it('видна только администратору', async () => {
    const db = seedOffice();
    await submit(db, 'u-0');

    const asParticipant = await run('{ pendingContributions { id } }', {
      db: db.client,
      userId: 'u-1',
    });
    expect(errorCode(asParticipant)).toBe('FORBIDDEN');

    const asAdmin = await runOk('{ pendingContributions { id status } }', {
      db: db.client,
      userId: ADMIN_ID,
    });
    expect(asAdmin.pendingContributions).toHaveLength(1);
  });
});
