/**
 * Единая лента событий фонда (§6.9) и её отбор.
 *
 * Взносы, заказы, отсутствия, выплаты и корректировки живут в разных таблицах,
 * но на таймлайне это один поток. Приведение к общему виду вынесено сюда,
 * а не в компонент: чистую функцию можно проверить без базы и без браузера,
 * а компонент после этого остаётся тонким.
 *
 * Дашборд **только показывает** (§6.9): ни одна цифра отсюда не участвует
 * в расчёте балансов. Источник истины — таблицы §6.3–§6.5 и инвариант §5.
 */

import { compareDates } from '@/lib/calc';
import type { AbsenceType, ContributionStatus, IsoDate } from '@/lib/calc/types';
import { rangesOverlap } from '@/lib/format/dates';
import type { Kopecks } from '@/lib/money';

/**
 * Тип события. Порядок закреплён: он же определяет слот палитры графиков
 * и порядок дорожек таймлайна (см. `--chart-1..5` в `globals.css`).
 */
export const EVENT_KINDS = [
  'CONTRIBUTION',
  'ORDER',
  'ABSENCE',
  'SETTLEMENT',
  'ADJUSTMENT',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

/**
 * Событие ленты.
 *
 * `startsOn` и `endsOn` — обе границы включительные. У точечных событий они
 * совпадают; отличается только отсутствие, у которого есть длительность,
 * и на таймлайне оно рисуется полосой, а не точкой (§6.9).
 */
export type TimelineEvent = {
  id: string;
  kind: EventKind;
  startsOn: IsoDate;
  endsOn: IsoDate;
  /** Знаковая сумма в копейках; `null` у отсутствия — деньгами оно не является. */
  amount: Kopecks | null;
  /** Участник; `null` у корректировки уровня фонда (§2.4). */
  userId: string | null;
  /** Статус взноса: неподтверждённый в фонд ещё не попал (правило 6). */
  status?: ContributionStatus;
  absenceType?: AbsenceType;
  note?: string;
};

/** Исходные строки в том виде, в каком их отдаёт слой данных. */
export type EventSource = {
  contributions: readonly {
    id: string;
    userId: string;
    amount: Kopecks;
    paidAt: IsoDate;
    status: ContributionStatus;
  }[];
  orders: readonly {
    id: string;
    amount: Kopecks;
    orderedAt: IsoDate;
    note?: string | null;
  }[];
  absences: readonly {
    id: string;
    userId: string;
    type: AbsenceType;
    startsOn: IsoDate;
    endsOn: IsoDate;
  }[];
  transactions: readonly {
    id: string;
    type: 'SETTLEMENT' | 'ADJUSTMENT';
    amount: Kopecks;
    userId: string | null;
    occurredOn: IsoDate;
    comment?: string | null;
  }[];
};

/** Порядок дорожек и разбора связей — по объявленному порядку типов. */
const KIND_ORDER = new Map<EventKind, number>(EVENT_KINDS.map((kind, index) => [kind, index]));

/**
 * Все события одним списком, отсортированные по дате начала.
 *
 * Сортировка полностью детерминирована — дата, затем тип, затем id: без
 * последнего ключа два события одного дня менялись бы местами между
 * отрисовками, и лента «дрожала» бы на каждом обновлении.
 */
export function buildEvents(source: EventSource): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const row of source.contributions) {
    events.push({
      id: `contribution:${row.id}`,
      kind: 'CONTRIBUTION',
      startsOn: row.paidAt,
      endsOn: row.paidAt,
      amount: row.amount,
      userId: row.userId,
      status: row.status,
    });
  }

  for (const row of source.orders) {
    events.push({
      id: `order:${row.id}`,
      kind: 'ORDER',
      startsOn: row.orderedAt,
      endsOn: row.orderedAt,
      // Заказ уносит деньги из фонда, поэтому в ленте он отрицателен (§2.3).
      amount: -row.amount,
      userId: null,
      note: row.note ?? undefined,
    });
  }

  for (const row of source.absences) {
    events.push({
      id: `absence:${row.id}`,
      kind: 'ABSENCE',
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      amount: null,
      userId: row.userId,
      absenceType: row.type,
    });
  }

  for (const row of source.transactions) {
    events.push({
      id: `transaction:${row.id}`,
      kind: row.type,
      startsOn: row.occurredOn,
      endsOn: row.occurredOn,
      amount: row.amount,
      userId: row.userId,
      note: row.comment ?? undefined,
    });
  }

  return events.sort(compareEvents);
}

export function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const byDate = compareDates(a.startsOn, b.startsOn);
  if (byDate !== 0) return byDate;

  const byKind = (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0);
  if (byKind !== 0) return byKind;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type EventFilter = {
  from: IsoDate;
  to: IsoDate;
  kinds: readonly EventKind[];
  /** Пустой список — все участники. */
  userIds: readonly string[];
};

/**
 * Отбор для таймлайна.
 *
 * Отсутствие попадает в выборку, если **пересекает** отрезок, а не лежит
 * внутри: отпуск, начавшийся в прошлом месяце и ещё не кончившийся, обязан
 * быть виден. То же правило действует в резолвере `absences` (§6.6).
 *
 * Событие без участника (заказ, общая корректировка) фильтр по участникам
 * не отбрасывает: оно касается всех сразу.
 */
export function filterEvents(
  events: readonly TimelineEvent[],
  filter: EventFilter,
): TimelineEvent[] {
  const kinds = new Set(filter.kinds);
  const users = new Set(filter.userIds);

  return events.filter((event) => {
    if (!kinds.has(event.kind)) return false;
    if (!rangesOverlap(event.startsOn, event.endsOn, filter.from, filter.to)) return false;
    if (users.size > 0 && event.userId !== null && !users.has(event.userId)) return false;
    return true;
  });
}

/** Пачка событий одного шага сетки (день, неделя или месяц). */
export type EventBucket = {
  /** Первый день корзины. */
  key: IsoDate;
  events: TimelineEvent[];
};

/**
 * Группировка ленты по гранулярности (§6.9).
 *
 * Пустые корзины не создаются: лента показывает то, что было, а не сетку
 * с дырами. Шаг влияет и на график — оба берут одну и ту же функцию ключа.
 */
export function groupEvents(
  events: readonly TimelineEvent[],
  keyOf: (date: IsoDate) => IsoDate,
): EventBucket[] {
  const buckets = new Map<IsoDate, TimelineEvent[]>();

  for (const event of events) {
    const key = keyOf(event.startsOn);
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [event]);
    else bucket.push(event);
  }

  return [...buckets.entries()]
    .map(([key, bucketEvents]) => ({ key, events: bucketEvents }))
    .sort((a, b) => compareDates(a.key, b.key));
}
