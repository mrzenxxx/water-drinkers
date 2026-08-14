/**
 * Раскладка таймлайна (§6.9).
 *
 * Событие превращается в отрезок `[start, start + length]` в долях ширины
 * окна, а отрезки раскладываются по строкам так, чтобы не наезжать друг
 * на друга. Отсутствия при этом остаются полосами, а не точками: у них есть
 * длительность, и терять её нельзя.
 *
 * Всё чистое: ни DOM, ни базы, ни часов — только арифметика по номеру дня.
 */

import { toEpochDay } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';

import type { EventKind, TimelineEvent } from './events';
import { spanFraction } from './chart';

export type PositionedEvent = {
  event: TimelineEvent;
  /** Левый край, 0..1 от ширины окна. */
  start: number;
  /** Ширина, 0..1. У точечного события — минимальная видимая. */
  length: number;
  /** Номер строки внутри дорожки: 0, 1, 2… */
  row: number;
};

export type Lane = {
  kind: EventKind;
  items: PositionedEvent[];
  /** Сколько строк заняла дорожка. */
  rows: number;
};

export type LaneWindow = { from: IsoDate; to: IsoDate };

/**
 * Минимальная ширина отметки в долях окна.
 *
 * Точечное событие (взнос, заказ) шириной в один день на годовом окне — это
 * три десятых процента: попасть в него курсором невозможно. Поэтому у метки
 * есть нижняя граница ширины, а точная дата всё равно написана в подсказке
 * и в списке под лентой.
 */
const MIN_LENGTH = 0.012;

/** Зазор между соседними отрезками одной строки, в долях окна. */
const ROW_GAP = 0.004;

/** Положение события в окне. Обе границы окна включительные. */
export function positionOf(
  event: TimelineEvent,
  window: LaneWindow,
): { start: number; length: number } {
  // Конец сдвинут на день вперёд: отсутствие «с 5 по 5» занимает целый день,
  // а не нулевую ширину. Границы окна включительные по той же причине.
  const { start, length } = spanFraction(
    toEpochDay(event.startsOn),
    toEpochDay(event.endsOn) + 1,
    toEpochDay(window.from),
    toEpochDay(window.to) + 1,
  );

  const visible = Math.max(length, MIN_LENGTH);
  // Метка, упёршаяся в правый край, не должна вылезать за окно.
  return { start: Math.min(start, 1 - visible), length: visible };
}

/**
 * Жадная укладка отрезков по строкам.
 *
 * Отрезок садится в первую строку, где он не задевает предыдущий. Порядок
 * входа сохраняется, поэтому раскладка детерминирована: одна и та же выборка
 * всегда даёт одну и ту же картинку.
 */
export function packRows(
  events: readonly TimelineEvent[],
  window: LaneWindow,
  maxRows = 6,
): PositionedEvent[] {
  const rowEnds: number[] = [];
  const placed: PositionedEvent[] = [];

  for (const event of events) {
    const { start, length } = positionOf(event, window);

    let row = rowEnds.findIndex((end) => end <= start - ROW_GAP);
    if (row === -1) {
      // Переполнение не прячет события: они ложатся в последнюю строку внахлёст.
      // Потерять событие хуже, чем показать его вплотную к соседу.
      row = rowEnds.length < maxRows ? rowEnds.length : maxRows - 1;
    }

    rowEnds[row] = start + length;
    placed.push({ event, start, length, row });
  }

  return placed;
}

/** Дорожки таймлайна: по одной на тип события, в закреплённом порядке. */
export function buildLanes(
  events: readonly TimelineEvent[],
  kinds: readonly EventKind[],
  window: LaneWindow,
): Lane[] {
  return kinds.map((kind) => {
    const items = packRows(
      events.filter((event) => event.kind === kind),
      window,
    );
    const rows = items.reduce((max, item) => Math.max(max, item.row + 1), 0);
    return { kind, items, rows };
  });
}
