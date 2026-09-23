/**
 * Сводка за период (§6.9).
 *
 * Цифры сверху статистики обязаны относиться ровно к тому же отрезку, что и
 * график под ними, поэтому и то и другое считается из одного набора событий
 * и одного диапазона — здесь.
 *
 * Статистика только показывает: ни одно из этих чисел не участвует в расчёте
 * балансов и не является источником истины (§6.9).
 */

import { addDays, compareDates, daysPresent, isCountedStatus } from '@/lib/calc';
import type { Absence, IsoDate, Participant } from '@/lib/calc/types';
import type { Kopecks } from '@/lib/money';

import type { TimelineEvent } from './events';
import { periodDays } from './filters';
import { daysBetween } from './series';

export type LargestOrder = { id: string; date: IsoDate; amount: Kopecks };

/** Самый длинный отрезок без закупок внутри периода. */
export type LongestGap = { from: IsoDate; to: IsoDate; days: number };

export type PeriodSummary = {
  from: IsoDate;
  to: IsoDate;
  days: number;
  /** Поступило: подтверждённые взносы плюс положительные корректировки. */
  received: Kopecks;
  /** Потрачено: положительная величина — заказы, выплаты, отрицательные корректировки. */
  spent: Kopecks;
  /** `received − spent`; совпадает с изменением остатка фонда за период. */
  netChange: Kopecks;
  /** Справочная величина: точное целочисленное деление, остаток отбрасывается. */
  averageDailySpend: Kopecks;
  orderCount: number;
  personDays: number;
  largestOrder: LargestOrder | null;
  longestGap: LongestGap | null;
};

export type SummaryInput = {
  events: readonly TimelineEvent[];
  participants: readonly Participant[];
  absences: readonly Absence[];
  range: { from: IsoDate; to: IsoDate };
};

/**
 * Человеко-дни периода — та же величина `D_k`, что в §4.4, но посчитанная
 * не по периоду потребления заказа, а по выбранному отрезку статистики.
 *
 * `daysPresent` работает по полуоткрытому `[from, to)` (§4.1), а границы
 * статистики включительные, поэтому верхняя двигается на день вперёд.
 */
export function personDaysIn(
  participants: readonly Participant[],
  absences: readonly Absence[],
  range: { from: IsoDate; to: IsoDate },
): number {
  const to = addDays(range.to, 1);
  let total = 0;
  for (const participant of participants) {
    total += daysPresent(participant, absences, range.from, to);
  }
  return total;
}

/**
 * Самый длинный промежуток без закупок.
 *
 * Считается по краям тоже: если заказов не было первые два месяца периода,
 * это ровно та пауза, которую §6.9 и просит показать.
 */
export function longestGapWithoutOrders(
  orderDates: readonly IsoDate[],
  range: { from: IsoDate; to: IsoDate },
): LongestGap | null {
  if (periodDays(range) === 0) return null;

  const dates = [...orderDates].sort(compareDates);
  const marks: IsoDate[] = [range.from, ...dates, range.to];

  let best: LongestGap | null = null;
  for (let index = 1; index < marks.length; index += 1) {
    const from = marks[index - 1]!;
    const to = marks[index]!;
    const days = daysBetween(from, to);
    if (best === null || days > best.days) best = { from, to, days };
  }

  return best;
}

export function summarizePeriod(input: SummaryInput): PeriodSummary {
  const { range } = input;
  const days = periodDays(range);

  let received = 0;
  let spent = 0;
  let orderCount = 0;
  let largestOrder: LargestOrder | null = null;
  const orderDates: IsoDate[] = [];

  for (const event of input.events) {
    // Полосой отсутствие попадает в период и краем; деньги считаются только
    // по событиям, чей день лежит внутри отрезка.
    if (event.amount === null) continue;
    if (compareDates(event.startsOn, range.from) < 0) continue;
    if (compareDates(event.startsOn, range.to) > 0) continue;
    // Взнос без подтверждения фонда не касается (правило 6).
    if (event.kind === 'CONTRIBUTION' && (event.status === undefined || !isCountedStatus(event.status))) continue;

    if (event.amount >= 0) received += event.amount;
    else spent += -event.amount;

    if (event.kind === 'ORDER') {
      orderCount += 1;
      orderDates.push(event.startsOn);
      const amount = -event.amount;
      if (largestOrder === null || amount > largestOrder.amount) {
        largestOrder = { id: event.id, date: event.startsOn, amount };
      }
    }
  }

  return {
    from: range.from,
    to: range.to,
    days,
    received,
    spent,
    netChange: received - spent,
    // Деньги — целые копейки (правило 2), поэтому среднее берётся точным
    // целочисленным делением, а не `Math.round` от числа с плавающей точкой.
    averageDailySpend: days === 0 ? 0 : (spent - (spent % days)) / days,
    orderCount,
    personDays: personDaysIn(input.participants, input.absences, range),
    largestOrder,
    longestGap: longestGapWithoutOrders(orderDates, range),
  };
}
