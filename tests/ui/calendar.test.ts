import { describe, expect, it } from 'vitest';

import {
  absencesByDay,
  absencesOfMonth,
  buildMonthGrid,
  type CalendarAbsence,
} from '@/lib/view/calendar';

const ABSENCES: CalendarAbsence[] = [
  { id: 'a1', userId: 'u-2', type: 'VACATION', startsOn: '2026-05-28', endsOn: '2026-06-03' },
  { id: 'a2', userId: 'u-1', type: 'SICK_LEAVE', startsOn: '2026-06-02', endsOn: '2026-06-02' },
  { id: 'a3', userId: 'u-1', type: 'VACATION', startsOn: '2026-07-05', endsOn: '2026-07-10' },
];

describe('сетка месяца', () => {
  const grid = buildMonthGrid('2026-06', '2026-06-15');

  it('состоит из полных недель с понедельника', () => {
    expect(grid.weeks.every((week) => week.length === 7)).toBe(true);
    // 1 июня 2026 — понедельник, 30 июня — вторник: пять недель.
    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks[0]?.[0]?.date).toBe('2026-06-01');
  });

  it('помечает хвосты соседнего месяца, выходные и сегодня', () => {
    const days = grid.weeks.flat();
    expect(days.filter((day) => day.inMonth)).toHaveLength(30);

    const july = days.find((day) => day.date === '2026-07-01');
    expect(july?.inMonth).toBe(false);

    expect(days.find((day) => day.date === '2026-06-06')?.isWeekend).toBe(true);
    expect(days.find((day) => day.date === '2026-06-08')?.isWeekend).toBe(false);
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2026-06-15']);
  });

  it('знает границы самого месяца', () => {
    expect(grid.from).toBe('2026-06-01');
    expect(grid.to).toBe('2026-06-30');
  });

  it('февраль, начинающийся с воскресенья, не теряет дней', () => {
    const february = buildMonthGrid('2026-02', '2026-06-15');
    expect(february.weeks.flat().filter((day) => day.inMonth)).toHaveLength(28);
  });
});

describe('отсутствия по дням', () => {
  it('раскладывает многодневное отсутствие на каждый день окна', () => {
    const byDay = absencesByDay(ABSENCES, '2026-06-01', '2026-06-30');
    expect(byDay.get('2026-06-01')?.map((absence) => absence.id)).toEqual(['a1']);
    // Второго июня отсутствуют оба, порядок по участнику.
    expect(byDay.get('2026-06-02')?.map((absence) => absence.userId)).toEqual(['u-1', 'u-2']);
    expect(byDay.get('2026-06-04')).toBeUndefined();
  });

  it('обрезает отсутствие окном, но не выбрасывает его', () => {
    const byDay = absencesByDay(ABSENCES, '2026-06-01', '2026-06-30');
    // Отпуск начался 28 мая — в июне видны только три его дня.
    const days = [...byDay.entries()].filter(([, list]) =>
      list.some((absence) => absence.id === 'a1'),
    );
    expect(days).toHaveLength(3);
  });

  it('не берёт то, что лежит целиком вне окна', () => {
    const byDay = absencesByDay(ABSENCES, '2026-06-01', '2026-06-30');
    expect([...byDay.values()].flat().some((absence) => absence.id === 'a3')).toBe(false);
  });
});

describe('список отсутствий месяца', () => {
  it('берёт всё, что задевает месяц, и сортирует по началу', () => {
    const list = absencesOfMonth(ABSENCES, '2026-06-01', '2026-06-30');
    expect(list.map((absence) => absence.id)).toEqual(['a1', 'a2']);
  });
});
