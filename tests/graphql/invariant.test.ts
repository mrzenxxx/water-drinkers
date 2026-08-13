import { describe, expect, it } from 'vitest';

import { addDays } from '@/lib/calc';
import { run, runOk, type GraphQLResponse } from '../support/graphql';
import { ADMIN_ID, seedOffice, START_DATE } from '../support/office';

/**
 * Инвариант §5 после **каждой** мутации, а не только в конце.
 *
 * Генеративный тест ядра (`tests/calc/invariant.generative.test.ts`) уже гоняет
 * случайные последовательности по чистым функциям. Здесь проверяется то, чего
 * он видеть не может: что путь «мутация → база → слой данных → ядро» не теряет
 * и не удваивает деньги по дороге. Последовательность операций случайная, но
 * детерминированная: сид печатается вместе с провалившейся проверкой.
 */

const RUNS = 40;
const OPERATIONS = 25;

/** mulberry32 — маленький, быстрый, полностью детерминированный. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[int(rng, 0, items.length - 1)] as T;

const SUBMIT = `mutation ($amount: Money!, $paidAt: Date!) { submitContribution(amount: $amount, paidAt: $paidAt) { id } }`;
const CONFIRM = `mutation ($id: ID!) { confirmContribution(id: $id) { id } }`;
const REJECT = `mutation ($id: ID!) { rejectContribution(id: $id, comment: "не сходится") { id } }`;
const ORDER = `mutation ($amount: Money!, $orderedAt: Date!) { createWaterOrder(input: { amount: $amount, orderedAt: $orderedAt }) { id } }`;
const ADD_ABSENCE = `mutation ($type: AbsenceType!, $startsOn: Date!, $endsOn: Date!) { addAbsence(type: $type, startsOn: $startsOn, endsOn: $endsOn) { id } }`;
const DELETE_ABSENCE = `mutation ($id: ID!) { deleteAbsence(id: $id) }`;

const CHECK = `
  {
    fund { balance balancesSum isConsistent }
    balances { user { id } amount }
    waterOrders { id amount shares { share } }
  }
`;

type Check = {
  fund: { balance: number; balancesSum: number; isConsistent: boolean };
  balances: { user: { id: string }; amount: number }[];
  waterOrders: { id: string; amount: number; shares: { share: number }[] }[];
};

describe('инвариант §5 после каждой мутации', () => {
  it('держится на случайных последовательностях операций', async () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const rng = makeRandom(seed);
      const db = seedOffice(int(rng, 1, 5));
      const everyone = [ADMIN_ID, ...db.participantIds];
      const asOf = addDays(START_DATE, 200);

      const pendingIds: string[] = [];
      const absenceIds: string[] = [];

      for (let step = 0; step < OPERATIONS; step += 1) {
        const actor = pick(rng, everyone);
        const day = addDays(START_DATE, int(rng, 0, 180));
        const options = { db: db.client, asOf } as const;

        // Мутации намеренно запускаются и без прав, и с невалидным входом:
        // отвергнутая операция обязана не оставлять следов в деньгах.
        const operation = int(rng, 0, 5);
        let result: GraphQLResponse;

        switch (operation) {
          case 0: {
            result = await run(SUBMIT, {
              ...options,
              userId: actor,
              variables: { amount: int(rng, 1, 200_000), paidAt: day },
            });
            const submitted = result.data?.submitContribution as { id: string } | undefined;
            if (submitted !== undefined) pendingIds.push(submitted.id);
            break;
          }
          case 1:
            result = await run(CONFIRM, {
              ...options,
              userId: actor,
              variables: { id: pendingIds.length === 0 ? 'нет такого' : pick(rng, pendingIds) },
            });
            break;
          case 2:
            result = await run(REJECT, {
              ...options,
              userId: actor,
              variables: { id: pendingIds.length === 0 ? 'нет такого' : pick(rng, pendingIds) },
            });
            break;
          case 3:
            result = await run(ORDER, {
              ...options,
              userId: actor,
              variables: { amount: int(rng, 1, 500_000), orderedAt: day },
            });
            break;
          case 4: {
            result = await run(ADD_ABSENCE, {
              ...options,
              userId: actor,
              variables: {
                type: pick(rng, ['VACATION', 'SICK_LEAVE']),
                startsOn: day,
                endsOn: addDays(day, int(rng, 0, 20)),
              },
            });
            const added = result.data?.addAbsence as { id: string } | undefined;
            if (added !== undefined) absenceIds.push(added.id);
            break;
          }
          default:
            result = await run(DELETE_ABSENCE, {
              ...options,
              userId: actor,
              variables: { id: absenceIds.length === 0 ? 'нет такого' : pick(rng, absenceIds) },
            });
        }

        const check = (await runOk(CHECK, { ...options, userId: ADMIN_ID })) as unknown as Check;

        const sum = check.balances.reduce((total, balance) => total + balance.amount, 0);
        expect(check.fund.isConsistent, `сид ${seed}, шаг ${step}`).toBe(true);
        expect(sum, `сид ${seed}, шаг ${step}: Σ балансов`).toBe(check.fund.balance);
        expect(check.fund.balancesSum, `сид ${seed}, шаг ${step}`).toBe(check.fund.balance);

        // Правило 3: доли заказа обязаны сходиться к его стоимости до копейки.
        for (const order of check.waterOrders) {
          const shares = order.shares.reduce((total, share) => total + share.share, 0);
          expect(shares, `сид ${seed}, шаг ${step}: доли заказа ${order.id}`).toBe(order.amount);
        }
      }
    }
  });
});
