import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk } from '../support/graphql';
import { ADMIN_ID, RECEIPT_ID, seedOffice } from '../support/office';

const CREATE = `
  mutation ($input: WaterOrderInput!) {
    createWaterOrder(input: $input) {
      id
      amount
      orderedAt
      bottlesCount
      supplier
      createdBy { id }
      consumptionPeriodEnd
      shares { daysPresent totalPersonDays share order { id } }
    }
  }
`;

const ORDER_INPUT = {
  amount: 300_000,
  orderedAt: '2026-06-05',
  bottlesCount: 10,
  supplier: 'Аквафор Доставка',
  receiptFileId: RECEIPT_ID,
};

describe('внесение заказа', () => {
  it('доступно только администратору', async () => {
    const db = seedOffice();

    const anonymous = await run(CREATE, { db: db.client, variables: { input: ORDER_INPUT } });
    expect(errorCode(anonymous)).toBe('UNAUTHENTICATED');

    const participant = await run(CREATE, {
      db: db.client,
      userId: 'u-0',
      variables: { input: ORDER_INPUT },
    });
    expect(errorCode(participant)).toBe('FORBIDDEN');
  });

  it('в журнал операций пишется отрицательная сумма (§4.5)', async () => {
    const db = seedOffice();
    const data = await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: '2026-07-05',
      variables: { input: ORDER_INPUT },
    });

    const order = data.createWaterOrder as { id: string; amount: number };
    // В таблице заказов сумма положительна — CHECK (amount > 0) из §11.
    expect(order.amount).toBe(300_000);
    expect(db.tables.waterOrder.rows[0]?.amount).toBe(300_000n);

    expect(db.tables.fundTransaction.rows).toHaveLength(1);
    expect(db.tables.fundTransaction.rows[0]).toMatchObject({
      type: 'ORDER',
      amount: -300_000n,
      refId: order.id,
      createdBy: ADMIN_ID,
    });

    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual(['order.create']);
  });

  it('распределяется на 100 % сразу и по всем участникам', async () => {
    const db = seedOffice();
    const data = await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      asOf: '2026-07-05',
      variables: { input: ORDER_INPUT },
    });

    const order = data.createWaterOrder as {
      shares: { share: number; daysPresent: number; order: { id: string } }[];
      consumptionPeriodEnd: string | null;
    };

    // Четверо в офисе (администратор тоже пьёт воду), период ещё открыт.
    expect(order.shares).toHaveLength(4);
    expect(order.consumptionPeriodEnd).toBeNull();
    expect(order.shares.reduce((sum, share) => sum + share.share, 0)).toBe(300_000);
  });

  it('закрывает период предыдущего заказа датой следующего', async () => {
    const db = seedOffice();
    await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: ORDER_INPUT },
    });
    await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...ORDER_INPUT, orderedAt: '2026-07-06' } },
    });

    const data = await runOk('{ waterOrders { orderedAt consumptionPeriodEnd } }', {
      db: db.client,
      userId: ADMIN_ID,
      asOf: '2026-08-01',
    });

    expect(data.waterOrders).toEqual([
      { orderedAt: '2026-07-06', consumptionPeriodEnd: null },
      { orderedAt: '2026-06-05', consumptionPeriodEnd: '2026-07-06' },
    ]);
  });

  it('не принимает ноль, минус и дробное число бутылей', async () => {
    const db = seedOffice();

    for (const amount of [0, -300_000]) {
      const result = await run(CREATE, {
        db: db.client,
        userId: ADMIN_ID,
        variables: { input: { ...ORDER_INPUT, amount } },
      });
      expect(errorCode(result), `сумма ${amount}`).toBe('BAD_USER_INPUT');
    }

    const bottles = await run(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...ORDER_INPUT, bottlesCount: 0 } },
    });
    expect(errorCode(bottles)).toBe('BAD_USER_INPUT');

    // Ни одной строки: неудачная мутация не оставляет следов.
    expect(db.tables.waterOrder.rows).toHaveLength(0);
    expect(db.tables.fundTransaction.rows).toHaveLength(0);
  });

  it('без чека не проходит: поставка отмечается только с подтверждением (§6.5)', async () => {
    const db = seedOffice();
    const { receiptFileId: _dropped, ...withoutReceipt } = ORDER_INPUT;

    const result = await run(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: withoutReceipt },
    });

    // Обязательность держится схемой, а не разметкой формы.
    expect(result.errors?.[0]?.message ?? '').toContain('receiptFileId');
    expect(db.tables.waterOrder.rows).toHaveLength(0);
  });

  it('с несуществующим чеком не проходит', async () => {
    const db = seedOffice();
    const result = await run(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...ORDER_INPUT, receiptFileId: '00000000-0000-0000-0000-000000000000' } },
    });

    expect(errorCode(result)).toBe('NOT_FOUND');
    expect(db.tables.waterOrder.rows).toHaveLength(0);
  });
});
