/**
 * Раскладка календаря команды (§6.6).
 *
 * Месячная сетка строится арифметикой по номеру дня эпохи — без `Date`
 * и без часовых поясов (см. `src/lib/format/dates.ts`). Всё чистое, поэтому
 * проверяется тестами без базы и браузера.
 */

import { addDays, compareDates, toEpochDay } from '@/lib/calc';
import type { AbsenceType, IsoDate } from '@/lib/calc/types';
import {
  daysInMonth,
  firstDayOfMonth,
  monthOf,
  startOfWeek,
  weekdayIndex,
} from '@/lib/format/dates';

export type CalendarDay = {
  date: IsoDate;
  /** День принадлежит показываемому месяцу, а не хвосту соседнего. */
  inMonth: boolean;
  isToday: boolean;
  /** Суббота или воскресенье. Выходные в расчёт не входят (§4.1), но видеть их полезно. */
  isWeekend: boolean;
};

export type CalendarMonth = {
  /** `YYYY-MM`. */
  month: string;
  from: IsoDate;
  to: IsoDate;
  weeks: CalendarDay[][];
};

/**
 * Сетка месяца: полные недели с понедельника по воскресенье.
 *
 * Хвосты соседних месяцев показываются приглушённо — без них последняя
 * неделя оказалась бы короче остальных и сетка «поехала» бы.
 */
export function buildMonthGrid(month: string, today: IsoDate): CalendarMonth {
  const first = firstDayOfMonth(month);
  const last = addDays(first, daysInMonth(month) - 1);

  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const total = toEpochDay(gridEnd) - toEpochDay(gridStart) + 1;

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < total; index += 1) {
    const date = addDays(gridStart, index);
    if (index % 7 === 0) weeks.push([]);

    weeks[weeks.length - 1]!.push({
      date,
      inMonth: monthOf(date) === month,
      isToday: date === today,
      isWeekend: weekdayIndex(date) >= 5,
    });
  }

  return { month, from: first, to: last, weeks };
}

/** Отсутствие в том виде, в каком его показывает календарь. */
export type CalendarAbsence = {
  id: string;
  userId: string;
  type: AbsenceType;
  startsOn: IsoDate;
  endsOn: IsoDate;
};

/**
 * Кто отсутствует в каждый день сетки.
 *
 * Ключ — дата, значение — отсутствия, накрывающие этот день. Порядок внутри
 * дня детерминирован (по участнику, затем по id): иначе список в ячейке
 * перетасовывался бы между отрисовками.
 */
export function absencesByDay(
  absences: readonly CalendarAbsence[],
  from: IsoDate,
  to: IsoDate,
): Map<IsoDate, CalendarAbsence[]> {
  const byDay = new Map<IsoDate, CalendarAbsence[]>();

  for (const absence of absences) {
    const start = compareDates(absence.startsOn, from) > 0 ? absence.startsOn : from;
    const end = compareDates(absence.endsOn, to) < 0 ? absence.endsOn : to;
    if (compareDates(start, end) > 0) continue;

    const length = toEpochDay(end) - toEpochDay(start) + 1;
    for (let offset = 0; offset < length; offset += 1) {
      const date = addDays(start, offset);
      const bucket = byDay.get(date);
      if (bucket === undefined) byDay.set(date, [absence]);
      else bucket.push(absence);
    }
  }

  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => (a.userId === b.userId ? compareIds(a.id, b.id) : compareIds(a.userId, b.userId)));
  }

  return byDay;
}

/**
 * Отсутствия, задевающие месяц, — списком под сеткой.
 *
 * Сортировка по дате начала: список читается как расписание, а не как выборка
 * из таблицы.
 */
export function absencesOfMonth(
  absences: readonly CalendarAbsence[],
  from: IsoDate,
  to: IsoDate,
): CalendarAbsence[] {
  return absences
    .filter(
      (absence) =>
        compareDates(absence.startsOn, to) <= 0 && compareDates(absence.endsOn, from) >= 0,
    )
    .sort(
      (a, b) =>
        compareDates(a.startsOn, b.startsOn) ||
        compareDates(a.endsOn, b.endsOn) ||
        compareIds(a.id, b.id),
    );
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
