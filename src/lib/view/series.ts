/**
 * Остаток фонда во времени — ряд для графика под таймлайном (§6.9).
 *
 * Ряд считается из тех же слагаемых, что и формула фонда §4.5:
 *
 *     Фонд = openingBalance + Σ CONTRIBUTION + Σ ORDER + Σ SETTLEMENT + Σ ADJUSTMENT
 *
 * и потому обязан сойтись с `CalcResult.fundBalance` на последней точке.
 * Это не украшение, а страховка: §6.9 прямо говорит, что расхождение между
 * дашбордом и таблицами — баг дашборда. Соответствие проверяется тестом.
 *
 * Ни базы, ни часов: вход → выход.
 */

import { compareDates, isCountedStatus, toEpochDay } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import type { Kopecks } from '@/lib/money';

import type { TimelineEvent } from './events';

/** Движение денег в фонде: дата и знаковая сумма. */
export type FundDelta = { date: IsoDate; amount: Kopecks };

/**
 * Денежные движения из ленты событий.
 *
 * Неподтверждённый взнос денег фонду не даёт (правило 6 CLAUDE.md), поэтому
 * в ряд не попадает — иначе график показывал бы деньги, которых в фонде нет.
 * Отсутствия суммы не имеют вовсе.
 */
export function fundDeltas(events: readonly TimelineEvent[]): FundDelta[] {
  const deltas: FundDelta[] = [];

  for (const event of events) {
    if (!movesFund(event)) continue;
    deltas.push({ date: event.startsOn, amount: event.amount ?? 0 });
  }

  return deltas.sort((a, b) => compareDates(a.date, b.date));
}

/** Двигает ли событие деньги фонда — то же правило, что у `fundDeltas`. */
function movesFund(event: TimelineEvent): boolean {
  if (event.amount === null) return false;
  return event.kind !== 'CONTRIBUTION' || (event.status !== undefined && isCountedStatus(event.status));
}

/**
 * События, из которых сложилась каждая ступень графика.
 *
 * Шаг ряда — остаток на **конец** корзины, поэтому событие относится к той
 * корзине, до ключа следующей которой оно случилось, — ровно по тому же
 * правилу, что и в `buildBalanceSeries`. Иначе подсказка на ступени
 * перечисляла бы не те операции, что её сдвинули.
 */
export function bucketMovements(
  events: readonly TimelineEvent[],
  range: { from: IsoDate; to: IsoDate },
  bucketKeys: readonly IsoDate[],
): TimelineEvent[][] {
  const buckets: TimelineEvent[][] = bucketKeys.map(() => []);
  if (buckets.length === 0) return buckets;

  for (const event of events) {
    if (!movesFund(event)) continue;
    if (compareDates(event.startsOn, range.from) < 0) continue;
    if (compareDates(event.startsOn, range.to) > 0) continue;

    let index = 0;
    while (
      index + 1 < bucketKeys.length &&
      compareDates(event.startsOn, bucketKeys[index + 1]!) >= 0
    ) {
      index += 1;
    }
    buckets[index]!.push(event);
  }

  return buckets;
}

/** Остаток фонда на утро дня `date`, то есть до всех операций этого дня. */
export function balanceBefore(
  deltas: readonly FundDelta[],
  date: IsoDate,
  openingBalance: Kopecks,
): Kopecks {
  let balance = openingBalance;
  for (const delta of deltas) {
    if (compareDates(delta.date, date) >= 0) break;
    balance += delta.amount;
  }
  return balance;
}

/** Точка ряда: остаток на конец корзины. */
export type BalancePoint = {
  /** Первый день корзины — им же подписана ось. */
  date: IsoDate;
  balance: Kopecks;
};

export type BalanceSeries = {
  /** Остаток на начало периода — та самая ступень, от которой всё идёт. */
  startBalance: Kopecks;
  points: BalancePoint[];
  min: Kopecks;
  max: Kopecks;
  /** Пересекал ли фонд ноль внутри периода (§6.9: этот момент выделяется). */
  crossesZero: boolean;
};

/**
 * Ряд остатка по корзинам периода.
 *
 * Корзины строятся сплошным рядом, включая пустые: пропущенный шаг превратил
 * бы равномерную ось в неравномерную, и ступень «ничего не происходило месяц»
 * читалась бы как «прошёл один день».
 */
export function buildBalanceSeries(
  deltas: readonly FundDelta[],
  openingBalance: Kopecks,
  range: { from: IsoDate; to: IsoDate },
  bucketKeys: readonly IsoDate[],
): BalanceSeries {
  const startBalance = balanceBefore(deltas, range.from, openingBalance);

  const inPeriod = deltas.filter(
    (delta) =>
      compareDates(delta.date, range.from) >= 0 && compareDates(delta.date, range.to) <= 0,
  );

  const points: BalancePoint[] = [];
  let running = startBalance;
  let cursor = 0;
  let min = startBalance;
  let max = startBalance;

  for (let index = 0; index < bucketKeys.length; index += 1) {
    const nextKey = bucketKeys[index + 1];
    while (
      cursor < inPeriod.length &&
      (nextKey === undefined || compareDates(inPeriod[cursor]!.date, nextKey) < 0)
    ) {
      running += inPeriod[cursor]!.amount;
      cursor += 1;
    }

    points.push({ date: bucketKeys[index]!, balance: running });
    if (running < min) min = running;
    if (running > max) max = running;
  }

  return {
    startBalance,
    points,
    min,
    max,
    crossesZero: min < 0 && max >= 0,
  };
}

/**
 * Ряд корзин от `from` до `to` включительно.
 *
 * Ключ первой корзины может лежать раньше `from` (неделя и месяц начинаются
 * не с произвольной даты) — это правильно: ось обязана показывать корзину
 * целиком, а не её обрезок.
 */
export function bucketKeys(
  range: { from: IsoDate; to: IsoDate },
  keyOf: (date: IsoDate) => IsoDate,
  next: (key: IsoDate) => IsoDate,
  limit = 800,
): IsoDate[] {
  const keys: IsoDate[] = [];
  let key = keyOf(range.from);

  // Ограничение — страховка от опечатки в дате: «01.06.0226» не должна
  // превращать страницу в семьдесят тысяч столбиков.
  while (compareDates(key, range.to) <= 0 && keys.length < limit) {
    keys.push(key);
    key = next(key);
  }

  return keys;
}

/** Индексы точек, между которыми ряд переходит через ноль. */
export function zeroCrossings(points: readonly BalancePoint[]): number[] {
  const crossings: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!.balance;
    const current = points[index]!.balance;
    if ((previous >= 0 && current < 0) || (previous < 0 && current >= 0)) {
      crossings.push(index);
    }
  }

  return crossings;
}

/** Сколько дней прошло между двумя датами. Отрицательных не бывает. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.max(0, toEpochDay(to) - toEpochDay(from));
}
