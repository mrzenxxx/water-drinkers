import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, RECEIPT_ID, seedOffice } from '../support/office';

const ADD = `
  mutation ($type: AbsenceType!, $startsOn: Date!, $endsOn: Date!, $note: String) {
    addAbsence(type: $type, startsOn: $startsOn, endsOn: $endsOn, note: $note) {
      id
      type
      startsOn
      endsOn
      note
      user { id }
    }
  }
`;

const DELETE = `mutation ($id: ID!) { deleteAbsence(id: $id) }`;

const VACATION = { type: 'VACATION', startsOn: '2026-06-10', endsOn: '2026-06-20' };

async function addVacation(db: ReturnType<typeof seedOffice>, userId: string, variables = VACATION) {
  const data = await runOk(ADD, { db: db.client, userId, variables });
  return (data.addAbsence as { id: string }).id;
}

describe('добавление отсутствия', () => {
  it('заводится на себя и требует входа', async () => {
    const db = seedOffice();

    const anonymous = await run(ADD, { db: db.client, variables: VACATION });
    expect(errorCode(anonymous)).toBe('UNAUTHENTICATED');

    const data = await runOk(ADD, { db: db.client, userId: 'u-0', variables: VACATION });
    expect(data.addAbsence).toMatchObject({
      type: 'VACATION',
      startsOn: '2026-06-10',
      endsOn: '2026-06-20',
      user: { id: 'u-0' },
    });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual(['absence.add']);
  });

  it('отсутствие на один день — это startsOn == endsOn', async () => {
    const db = seedOffice();
    const data = await runOk(ADD, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'SICK_LEAVE', startsOn: '2026-06-10', endsOn: '2026-06-10' },
    });
    expect(data.addAbsence).toMatchObject({ startsOn: '2026-06-10', endsOn: '2026-06-10' });
  });

  it('конец раньше начала не принимается', async () => {
    const db = seedOffice();
    const result = await run(ADD, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'VACATION', startsOn: '2026-06-20', endsOn: '2026-06-10' },
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });

  it('пересечение отвергается внятной ошибкой, а не пятисоткой', async () => {
    const db = seedOffice();
    await addVacation(db, 'u-0');

    // Внахлёст, встык изнутри и накрывающее целиком — всё это пересечения:
    // границы в §11 включительны с обеих сторон.
    const overlaps = [
      { type: 'SICK_LEAVE', startsOn: '2026-06-15', endsOn: '2026-06-25' },
      { type: 'VACATION', startsOn: '2026-06-20', endsOn: '2026-06-21' },
      { type: 'VACATION', startsOn: '2026-06-01', endsOn: '2026-06-30' },
    ];

    for (const variables of overlaps) {
      const result = await run(ADD, { db: db.client, userId: 'u-0', variables });
      expect(errorCode(result), JSON.stringify(variables)).toBe('ABSENCE_OVERLAP');
      expect(result.errors?.[0]?.message).toContain('пересекается');
    }

    expect(db.tables.absence.rows).toHaveLength(1);
  });

  it('встык через день — не пересечение', async () => {
    const db = seedOffice();
    await addVacation(db, 'u-0');
    await runOk(ADD, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'SICK_LEAVE', startsOn: '2026-06-21', endsOn: '2026-06-25' },
    });
    expect(db.tables.absence.rows).toHaveLength(2);
  });

  it('чужое отсутствие пересечению не мешает', async () => {
    const db = seedOffice();
    await addVacation(db, 'u-0');
    await addVacation(db, 'u-1');
    expect(db.tables.absence.rows).toHaveLength(2);
  });

  it('уменьшает долю участника в заказе (§4.1)', async () => {
    const db = seedOffice(1); // администратор и один участник
    await runOk(
      `mutation ($input: WaterOrderInput!) { createWaterOrder(input: $input) { id } }`,
      {
        db: db.client,
        userId: ADMIN_ID,
        variables: { input: { amount: 200_000, orderedAt: '2026-06-01', receiptFileId: RECEIPT_ID } },
      },
    );

    const before = await runOk('{ balances { user { id } amount } }', {
      db: db.client,
      userId: ADMIN_ID,
      asOf: '2026-07-01',
    });
    // Порядок — как в выборке участников для расчёта: по id.
    expect(before.balances).toEqual([
      { user: { id: 'u-0' }, amount: -100_000 },
      { user: { id: ADMIN_ID }, amount: -100_000 },
    ]);

    // Участник в отпуске половину периода: 15 дней из 30.
    await runOk(ADD, {
      db: db.client,
      userId: 'u-0',
      variables: { type: 'VACATION', startsOn: '2026-06-16', endsOn: '2026-06-30' },
    });

    const after = await runOk('{ fund { isConsistent balance balancesSum } balances { user { id } amount } }', {
      db: db.client,
      userId: ADMIN_ID,
      asOf: '2026-07-01',
    });
    // 45 человеко-дней: 200 000 × 30/45 = 133 333,33 и 200 000 × 15/45 = 66 666,67.
    // Лишняя копейка уходит наибольшему остатку (§4.6) — участнику, а не админу.
    expect(after.balances).toEqual([
      { user: { id: 'u-0' }, amount: -66_667 },
      { user: { id: ADMIN_ID }, amount: -133_333 },
    ]);
    expect(after.fund).toMatchObject({ isConsistent: true, balance: -200_000, balancesSum: -200_000 });
  });
});

describe('удаление отсутствия', () => {
  it('своё удаляется, чужое — нет', async () => {
    const db = seedOffice();
    const id = await addVacation(db, 'u-0');

    const stranger = await run(DELETE, { db: db.client, userId: 'u-1', variables: { id } });
    expect(errorCode(stranger)).toBe('FORBIDDEN');
    expect(db.tables.absence.rows).toHaveLength(1);

    const owner = await runOk(DELETE, { db: db.client, userId: 'u-0', variables: { id } });
    expect(owner.deleteAbsence).toBe(true);
    expect(db.tables.absence.rows).toHaveLength(0);
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'absence.add',
      'absence.delete',
    ]);
  });

  it('администратор удаляет чужое', async () => {
    const db = seedOffice();
    const id = await addVacation(db, 'u-0');

    const data = await runOk(DELETE, { db: db.client, userId: ADMIN_ID, variables: { id } });
    expect(data.deleteAbsence).toBe(true);
  });

  it('повторное удаление возвращает false, а не ошибку', async () => {
    const db = seedOffice();
    const id = await addVacation(db, 'u-0');
    await runOk(DELETE, { db: db.client, userId: 'u-0', variables: { id } });

    const again = await runOk(DELETE, { db: db.client, userId: 'u-0', variables: { id } });
    expect(again.deleteAbsence).toBe(false);
  });
});
