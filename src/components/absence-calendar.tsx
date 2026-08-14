import type { ReactNode } from 'react';

import type { AbsenceType } from '@/lib/calc/types';
import { ABSENCE_TYPE_LABEL, WEEKDAYS_SHORT, shortName, type NamedUser } from '@/lib/format';
import { absencesByDay, buildMonthGrid, type CalendarAbsence } from '@/lib/view/calendar';
import { cn } from '@/lib/utils';

/**
 * Календарь команды на месяц (§6.6).
 *
 * Отпуск и больничный различаются **и цветом, и подписью**: у чипа стоит
 * буква типа, а полное название читает экранный диктор и подсказка браузера.
 * Цвет здесь ускоряет чтение, но ничего не решает в одиночку (§12).
 *
 * Раскладка вынесена в чистые функции (`src/lib/view/calendar.ts`) и покрыта
 * тестами; компонент только рисует то, что они вернули.
 */

const TYPE_COLOR: Record<AbsenceType, string> = {
  VACATION: 'var(--chart-3)',
  SICK_LEAVE: 'var(--chart-4)',
};

/** Однобуквенная метка типа: цвет не должен оставаться единственным различием. */
const TYPE_MARK: Record<AbsenceType, string> = {
  VACATION: 'О',
  SICK_LEAVE: 'Б',
};

/** Сколько имён помещается в ячейку до «ещё N». */
const NAMES_PER_DAY = 3;

export function AbsenceCalendar({
  month,
  today,
  absences,
  people,
  highlightUserId,
}: {
  /** `YYYY-MM`. */
  month: string;
  today: string;
  absences: readonly CalendarAbsence[];
  people: ReadonlyMap<string, NamedUser>;
  /** Свои отсутствия выделяются рамкой — искать себя в списке не приходится. */
  highlightUserId?: string;
}): ReactNode {
  const grid = buildMonthGrid(month, today);
  const first = grid.weeks[0]?.[0]?.date ?? grid.from;
  const lastWeek = grid.weeks[grid.weeks.length - 1];
  const last = lastWeek?.[lastWeek.length - 1]?.date ?? grid.to;
  const byDay = absencesByDay(absences, first, last);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((day) => (
          <div key={day} className="text-muted-foreground pb-1 text-center text-xs">
            {day}
          </div>
        ))}

        {grid.weeks.flat().map((day) => {
          const dayAbsences = byDay.get(day.date) ?? [];
          const visible = dayAbsences.slice(0, NAMES_PER_DAY);
          const hidden = dayAbsences.length - visible.length;

          return (
            <div
              key={day.date}
              className={cn(
                'border-border min-h-16 rounded-md border p-1 text-xs',
                !day.inMonth && 'opacity-45',
                day.isWeekend && 'bg-muted/40',
                day.isToday && 'ring-ring ring-2',
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn('tabular', day.isToday && 'font-semibold')}>
                  {Number(day.date.slice(8))}
                </span>
                {day.isToday && <span className="text-muted-foreground text-[10px]">сегодня</span>}
              </div>

              <ul className="mt-1 flex flex-col gap-0.5">
                {visible.map((absence) => {
                  const person = people.get(absence.userId);
                  return (
                    <li
                      key={absence.id}
                      title={`${person === undefined ? absence.userId : shortName(person)} — ${ABSENCE_TYPE_LABEL[absence.type]}`}
                      className={cn(
                        'flex items-center gap-1 truncate rounded-sm px-1 py-0.5 text-[11px]',
                        absence.userId === highlightUserId && 'ring-foreground/40 ring-1',
                      )}
                      style={{ background: `color-mix(in oklab, ${TYPE_COLOR[absence.type]} 18%, transparent)` }}
                    >
                      <span
                        aria-hidden
                        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                        style={{ background: TYPE_COLOR[absence.type] }}
                      >
                        {TYPE_MARK[absence.type]}
                      </span>
                      <span className="truncate">
                        {person === undefined ? '—' : shortName(person)}
                      </span>
                      <span className="sr-only">{ABSENCE_TYPE_LABEL[absence.type]}</span>
                    </li>
                  );
                })}
                {hidden > 0 && <li className="text-muted-foreground px-1">ещё {hidden}</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {(['VACATION', 'SICK_LEAVE'] as const).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ background: TYPE_COLOR[type] }}
            >
              {TYPE_MARK[type]}
            </span>
            {ABSENCE_TYPE_LABEL[type]}
          </span>
        ))}
        <span className="text-muted-foreground">
          Оба типа считаются в расчёте одинаково: человека нет в офисе — он за эти дни не платит.
        </span>
      </div>
    </div>
  );
}
