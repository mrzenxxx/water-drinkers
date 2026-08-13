/**
 * Деньги на границе с базой.
 *
 * В базе суммы — `BIGINT` (§2.2, правило 2 CLAUDE.md), в коде — `number`
 * копеек. Переход между ними единственное место во всём проекте, где точность
 * может потеряться молча: `Number(bigint)` за пределами 2^53 округляет и не
 * жалуется. Поэтому здесь стоит явная проверка, а не приведение типа.
 *
 * 2^53 копеек — это 90 триллионов рублей. Офисная касса до такого не дорастёт,
 * и проверка никогда не сработает. В этом и смысл: если она сработала, число
 * пришло не из кассы, и продолжать расчёт нельзя.
 */

import { assertKopecks, type Kopecks } from '@/lib/money';

/** `BIGINT` → копейки. Бросает, если значение не помещается в безопасное целое. */
export function toKopecks(value: bigint, what = 'сумма'): Kopecks {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${what}: ожидался BigInt, получено ${typeof value}`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || BigInt(result) !== value) {
    throw new RangeError(`${what}: ${value} не помещается в безопасное целое число копеек`);
  }
  return result;
}

/** Копейки → `BIGINT` для записи в базу. */
export function toBigIntKopecks(value: Kopecks, what = 'сумма'): bigint {
  assertKopecks(value, what);
  return BigInt(value);
}
