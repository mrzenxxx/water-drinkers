import { describe, expect, it } from 'vitest';

import { isSectionActive } from '@/lib/view/nav';
import { EVENT_KINDS, buildEvents, type EventSource } from '@/lib/view/events';
import { buildLanes, packRows, positionOf } from '@/lib/view/timeline';

const WINDOW = { from: '2026-06-01', to: '2026-06-30' };

const SOURCE: EventSource = {
  contributions: [
    { id: 'c1', userId: 'u-1', amount: 50_000, paidAt: '2026-06-02', status: 'CONFIRMED' },
    { id: 'c2', userId: 'u-2', amount: 50_000, paidAt: '2026-06-02', status: 'CONFIRMED' },
  ],
  orders: [{ id: 'o1', amount: 300_000, orderedAt: '2026-06-16' }],
  absences: [
    { id: 'a1', userId: 'u-1', type: 'VACATION', startsOn: '2026-06-01', endsOn: '2026-06-10' },
    { id: 'a2', userId: 'u-2', type: 'SICK_LEAVE', startsOn: '2026-06-05', endsOn: '2026-06-08' },
    { id: 'a3', userId: 'u-1', type: 'VACATION', startsOn: '2026-06-20', endsOn: '2026-06-25' },
  ],
  transactions: [],
};

const events = buildEvents(SOURCE);
const absences = events.filter((event) => event.kind === 'ABSENCE');

describe('положение события в окне', () => {
  it('отсутствие занимает свои дни, а не точку', () => {
    const position = positionOf(absences[0]!, WINDOW);
    expect(position.start).toBeCloseTo(0, 6);
    // 10 дней из 30.
    expect(position.length).toBeCloseTo(10 / 30, 6);
  });

  it('однодневное событие получает видимую ширину, а не ноль', () => {
    const contribution = events.find((event) => event.kind === 'CONTRIBUTION')!;
    expect(positionOf(contribution, WINDOW).length).toBeGreaterThan(0.01);
  });

  it('событие у правого края не вылезает за окно', () => {
    const last = positionOf(
      { ...absences[0]!, startsOn: '2026-06-30', endsOn: '2026-06-30' },
      WINDOW,
    );
    expect(last.start + last.length).toBeLessThanOrEqual(1.000001);
  });

  it('отсутствие, начавшееся до окна, обрезается, но остаётся видимым', () => {
    const position = positionOf(
      { ...absences[0]!, startsOn: '2026-05-01', endsOn: '2026-06-05' },
      WINDOW,
    );
    expect(position.start).toBe(0);
    expect(position.length).toBeCloseTo(5 / 30, 6);
  });
});

describe('укладка по строкам', () => {
  it('разводит пересекающиеся полосы по разным строкам', () => {
    const placed = packRows(absences, WINDOW);
    const [first, second, third] = placed;
    expect(first?.row).toBe(0);
    // a2 (05–08) пересекается с a1 (01–10) — уходит во вторую строку.
    expect(second?.row).toBe(1);
    // a3 (20–25) начинается после a1 — снова первая строка.
    expect(third?.row).toBe(0);
  });

  it('раскладка детерминирована', () => {
    expect(packRows(absences, WINDOW).map((item) => item.row)).toEqual(
      packRows(absences, WINDOW).map((item) => item.row),
    );
  });

  it('при переполнении события не теряются', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...absences[0]!,
      id: `overlap-${index}`,
    }));
    const placed = packRows(many, WINDOW, 3);
    expect(placed).toHaveLength(12);
    expect(Math.max(...placed.map((item) => item.row))).toBe(2);
  });
});

describe('дорожки таймлайна', () => {
  it('дорожка на каждый тип, в закреплённом порядке', () => {
    const lanes = buildLanes(events, [...EVENT_KINDS], WINDOW);
    expect(lanes.map((lane) => lane.kind)).toEqual([...EVENT_KINDS]);
    expect(lanes.find((lane) => lane.kind === 'ABSENCE')?.rows).toBe(2);
    expect(lanes.find((lane) => lane.kind === 'SETTLEMENT')?.items).toEqual([]);
  });

  it('показывает только запрошенные типы', () => {
    const lanes = buildLanes(events, ['ORDER'], WINDOW);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.items).toHaveLength(1);
  });
});

describe('подсветка раздела в навигации', () => {
  const hrefs = ['/', '/contributions', '/contributions/all', '/fund'];

  it('главная загорается только на точном совпадении', () => {
    expect(isSectionActive('/', '/', hrefs)).toBe(true);
    expect(isSectionActive('/fund', '/', hrefs)).toBe(false);
  });

  it('вложенный раздел забирает подсветку у родителя', () => {
    expect(isSectionActive('/contributions/all', '/contributions', hrefs)).toBe(false);
    expect(isSectionActive('/contributions/all', '/contributions/all', hrefs)).toBe(true);
    expect(isSectionActive('/contributions', '/contributions', hrefs)).toBe(true);
  });
});
