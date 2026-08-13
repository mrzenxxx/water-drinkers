/**
 * Перевод дат между базой и ядром расчёта.
 *
 * Ядро оперирует строками `YYYY-MM-DD` и про часовые пояса не знает вовсе
 * (`src/lib/calc/dates.ts`). В базе календарные поля объявлены как `DATE`
 * (§11), и драйвер отдаёт их объектом `Date`, поставленным на полночь **UTC**.
 * Прочитать такой объект локальными геттерами — значит уехать на день назад
 * в любой зоне западнее Гринвича и на день вперёд восточнее: 2026-06-01
 * превращается в 2026-05-31. Ошибка тихая, вылезает не у всех и не всегда.
 *
 * Отсюда правило: календарная дата пишется и читается **только** через
 * `fromIsoDate` / `toIsoDate`, и обе работают в UTC. Одно место, один тест.
 *
 * Отдельная история — `TIMESTAMPTZ` (`created_at`, `submitted_at`): это не
 * календарный день, а момент времени. Его календарный день зависит от зоны,
 * поэтому он берётся `instantToIsoDate` в зоне процесса — см. комментарий там.
 */

import type { IsoDate } from '@/lib/calc/types';
import { isIsoDate } from '@/lib/calc';

/** Полночь UTC — ровно то, что PostgreSQL хранит в колонке `DATE`. */
export function fromIsoDate(value: IsoDate): Date {
  if (!isIsoDate(value)) {
    throw new RangeError(`"${String(value)}" не дата в формате YYYY-MM-DD`);
  }
  // `Date.UTC` вместо `new Date(value)` — не из вкуса: разбор строки движком
  // зависит от её формата, а UTC-конструктор не зависит ни от чего.
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

/** Значение колонки `DATE` → `YYYY-MM-DD`. Читается в UTC, см. шапку файла. */
export function toIsoDate(value: Date): IsoDate {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`ожидался объект Date, получено ${String(value)}`);
  }
  return format(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

/** То же, но для необязательной колонки. */
export function toIsoDateOrNull(value: Date | null): IsoDate | null {
  return value === null ? null : toIsoDate(value);
}

/**
 * Календарный день момента времени (`TIMESTAMPTZ`) в зоне процесса.
 *
 * Здесь UTC был бы неправильным ответом: заказ, внесённый в Петербурге в час
 * ночи, попал бы во вчерашний день. Зона задаётся переменной `TZ` на сервере —
 * это единственное место, где она вообще на что-то влияет.
 */
export function instantToIsoDate(value: Date): IsoDate {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`ожидался объект Date, получено ${String(value)}`);
  }
  return format(value.getFullYear(), value.getMonth() + 1, value.getDate());
}

/** `TIMESTAMPTZ` → ISO 8601 для скаляра `DateTime`. */
export function toIsoDateTime(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`ожидался объект Date, получено ${String(value)}`);
  }
  return value.toISOString();
}

export function toIsoDateTimeOrNull(value: Date | null): string | null {
  return value === null ? null : toIsoDateTime(value);
}

/**
 * «Сегодня» для расчёта (`CalcInput.asOf`, §4.3): конец открытого периода
 * потребления последнего заказа. Часы читаются здесь, чтобы ядро осталось
 * чистым — внутрь `src/lib/calc/` время не попадает никогда.
 */
export function todayIso(now: Date = new Date()): IsoDate {
  return instantToIsoDate(now);
}

function format(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
