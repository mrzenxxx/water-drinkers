/**
 * Даты для экрана.
 *
 * Формат хранения и расчёта — строка `YYYY-MM-DD` (§4.1). Объект `Date` здесь
 * не создаётся ни разу: он тянет за собой часовой пояс, а «01.06.2026» западнее
 * Гринвича превратилось бы в «31.05.2026». Ровно этот класс ошибок описан
 * в шапке `src/lib/data/dates.ts` — здесь та же осторожность на выходе.
 *
 * Всё в файле — чистые функции от строки к строке.
 */

import type { IsoDate } from '@/lib/calc/types';
import { addDays, compareDates, toEpochDay } from '@/lib/calc';

const MONTHS_NOMINATIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
] as const;

/** Понедельник первым: календарь §6.6 рисуется по рабочей неделе. */
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

function parts(date: IsoDate): [year: number, month: number, day: number] {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return [year, month, day];
}

/** `2026-06-05` → `05.06.2026`. Формат для таблиц: одинаковая ширина у всех строк. */
export function formatDate(date: IsoDate): string {
  const [year, month, day] = parts(date);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

/** `2026-06-05` → `5 июня`. Для лент и подписей, где год очевиден из контекста. */
export function formatDayMonth(date: IsoDate): string {
  const [, month, day] = parts(date);
  return `${day} ${MONTHS_GENITIVE[month - 1]}`;
}

/** `2026-06-05` → `5 июня 2026`. */
export function formatLongDate(date: IsoDate): string {
  const [year, month, day] = parts(date);
  return `${day} ${MONTHS_GENITIVE[month - 1]} ${year}`;
}

/** `2026-06` → `июнь 2026`. Заголовок месяца в календаре. */
export function formatMonth(month: string): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_NOMINATIVE[index - 1]} ${year}`;
}

/** `2026-06` → `июн 26`. Подпись оси: длинное название её разорвёт. */
export function formatMonthShort(month: string): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_SHORT[index - 1]} ${String(year).slice(2)}`;
}

/**
 * Диапазон дат человеческой строкой: общий месяц и год не повторяются.
 * `5–7 июня 2026`, `28 мая — 3 июня 2026`, `5 июня 2026 — 4 января 2027`.
 */
export function formatDateRange(from: IsoDate, to: IsoDate): string {
  const [fromYear, fromMonth, fromDay] = parts(from);
  const [toYear, toMonth, toDay] = parts(to);

  if (from === to) return formatLongDate(from);
  if (fromYear === toYear && fromMonth === toMonth) {
    return `${fromDay}–${toDay} ${MONTHS_GENITIVE[toMonth - 1]} ${toYear}`;
  }
  if (fromYear === toYear) {
    return `${fromDay} ${MONTHS_GENITIVE[fromMonth - 1]} — ${toDay} ${MONTHS_GENITIVE[toMonth - 1]} ${toYear}`;
  }
  return `${formatLongDate(from)} — ${formatLongDate(to)}`;
}

/**
 * `сегодня` / `вчера` / `5 июня` — относительно переданного «сегодня».
 *
 * «Сегодня» приходит аргументом, а не из часов: функция обязана оставаться
 * чистой, иначе её нельзя ни протестировать, ни отрисовать на сервере
 * предсказуемо.
 */
export function formatRelativeDate(date: IsoDate, today: IsoDate): string {
  const diff = toEpochDay(date) - toEpochDay(today);
  if (diff === 0) return 'сегодня';
  if (diff === -1) return 'вчера';
  if (diff === 1) return 'завтра';
  return formatDayMonth(date);
}

/** ISO 8601 → `05.06.2026, 14:30`. Момент времени показываем в зоне процесса. */
export function formatDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;

  const date = `${String(at.getDate()).padStart(2, '0')}.${String(at.getMonth() + 1).padStart(2, '0')}.${at.getFullYear()}`;
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return `${date}, ${time}`;
}

/** `YYYY-MM` месяца, которому принадлежит дата. */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/** Первый день месяца `YYYY-MM`. */
export function firstDayOfMonth(month: string): IsoDate {
  return `${month}-01`;
}

/** Последний день месяца `YYYY-MM`. */
export function lastDayOfMonth(month: string): IsoDate {
  return addDays(firstDayOfMonth(shiftMonth(month, 1)), -1);
}

/** Сдвиг месяца `YYYY-MM` на `delta` месяцев в любую сторону. */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const zeroBased = year * 12 + (index - 1) + delta;
  const shiftedYear = Math.floor(zeroBased / 12);
  const shiftedMonth = zeroBased - shiftedYear * 12 + 1;
  return `${String(shiftedYear).padStart(4, '0')}-${String(shiftedMonth).padStart(2, '0')}`;
}

/** Сколько дней в месяце `YYYY-MM`. */
export function daysInMonth(month: string): number {
  return toEpochDay(firstDayOfMonth(shiftMonth(month, 1))) - toEpochDay(firstDayOfMonth(month));
}

/**
 * Сдвиг **даты** на `delta` месяцев с прижатием к концу месяца:
 * 31 марта минус месяц — 28 (или 29) февраля, а не 3 марта.
 *
 * Нужен быстрым периодам дашборда (§6.9): «месяц назад» обязан давать
 * ровно одну дату, а не зависеть от длины соседнего месяца.
 */
export function shiftDateByMonths(date: IsoDate, delta: number): IsoDate {
  const [, , day] = parts(date);
  const month = shiftMonth(monthOf(date), delta);
  const clamped = Math.min(day, daysInMonth(month));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/**
 * День недели, 0 — понедельник.
 *
 * 1970-01-01 был четвергом, отсюда сдвиг на 3. Считается по номеру дня эпохи,
 * без `Date`: см. шапку файла.
 */
export function weekdayIndex(date: IsoDate): number {
  return (((toEpochDay(date) + 3) % 7) + 7) % 7;
}

/** Понедельник недели, в которую попадает дата. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -weekdayIndex(date));
}

/** Пересекаются ли включительные отрезки `[aFrom, aTo]` и `[bFrom, bTo]`. */
export function rangesOverlap(
  aFrom: IsoDate,
  aTo: IsoDate,
  bFrom: IsoDate,
  bTo: IsoDate,
): boolean {
  return compareDates(aFrom, bTo) <= 0 && compareDates(bFrom, aTo) <= 0;
}
