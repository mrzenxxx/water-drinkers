/**
 * Состояние дашборда (§6.9) — в адресе страницы.
 *
 * «Диапазон отражается в адресе, чтобы состоянием экрана можно было
 * поделиться ссылкой» — прямое требование §6.9. Отсюда правило: разбор и
 * сборка `searchParams` живут в чистой функции, а не в компоненте. Компонент
 * не хранит фильтры в состоянии вовсе: источник правды — адрес.
 *
 * Разбор недоверчивый и никогда не бросает: ссылку могли поправить руками,
 * и мусор в параметре не повод показать вместо дашборда ошибку.
 */

import { addDays, compareDates, isIsoDate, maxDate, minDate, toEpochDay } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import { monthOf, shiftDateByMonths, startOfWeek } from '@/lib/format/dates';

import { EVENT_KINDS, isEventKind, type EventKind } from './events';

export const PERIOD_PRESETS = ['month', 'quarter', 'year', 'all', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const GRANULARITIES = ['day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'Всё время',
  custom: 'Произвольный',
};

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

/**
 * Типы событий, которые включаются и выключаются в фильтре.
 *
 * Выплат среди них нет: это редкое событие — расчёт с уходящим участником,
 * и отдельный переключатель ради него только занимал место в панели. В ленте
 * выплата видна всегда: спрятанная, она оставила бы в «Потрачено» сумму,
 * которой нет ни в одной строке ниже.
 */
export const FILTER_KINDS: readonly EventKind[] = EVENT_KINDS.filter(
  (kind) => kind !== 'SETTLEMENT',
);

export type DashboardFilters = {
  preset: PeriodPreset;
  from: IsoDate;
  to: IsoDate;
  granularity: Granularity;
  /** Пустой список — все участники. */
  userIds: string[];
  kinds: EventKind[];
  /** Шаг задан в адресе явно, а не выведен из длины периода. */
  granularityPinned: boolean;
};

/** Что нужно знать разбору помимо самого адреса. */
export type FilterContext = {
  /** «Сегодня» приходит аргументом — функция обязана остаться чистой. */
  today: IsoDate;
  /** Самая ранняя известная дата: с неё начинается период «всё время». */
  earliest: IsoDate;
};

/** То, что отдаёт Next.js в `searchParams`. */
export type RawParams = Record<string, string | string[] | undefined>;

function firstValue(params: RawParams, key: string): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

/** `a,b,c` или повторённый параметр — оба варианта в один список. */
function listValue(params: RawParams, key: string): string[] {
  const value = params[key];
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return raw
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readDate(params: RawParams, key: string): IsoDate | null {
  const value = firstValue(params, key);
  return value !== undefined && isIsoDate(value) ? value : null;
}

/** Границы быстрого периода. Все они кончаются сегодняшним днём. */
export function presetRange(
  preset: Exclude<PeriodPreset, 'custom'>,
  context: FilterContext,
): { from: IsoDate; to: IsoDate } {
  if (preset === 'all') {
    // Даже на пустой базе период не должен схлопнуться в отрицательный.
    return { from: minDate(context.earliest, context.today), to: context.today };
  }

  const months = preset === 'month' ? 1 : preset === 'quarter' ? 3 : 12;
  // Полуоткрытость здесь ни при чём: обе границы дашборда включительные,
  // поэтому «месяц» — это день, следующий за сдвигом, и по сегодня.
  return { from: addDays(shiftDateByMonths(context.today, -months), 1), to: context.today };
}

/**
 * Шаг сетки по умолчанию.
 *
 * Дневной шаг на трёх годах даёт тысячу засечек и нечитаемую ленту, месячный
 * на двух неделях — один столбик. Поэтому шаг выводится из длины периода,
 * пока пользователь не задал его сам.
 */
export function defaultGranularity(from: IsoDate, to: IsoDate): Granularity {
  const days = toEpochDay(to) - toEpochDay(from) + 1;
  if (days <= 62) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

/** Разбор адреса в фильтры. Никогда не бросает — см. шапку файла. */
export function parseDashboardFilters(params: RawParams, context: FilterContext): DashboardFilters {
  const rawPreset = firstValue(params, 'period');
  const from = readDate(params, 'from');
  const to = readDate(params, 'to');

  // Пара дат в адресе сильнее ярлыка периода: ссылкой делятся ради дат.
  const custom = from !== null && to !== null;
  const preset: PeriodPreset = custom
    ? 'custom'
    : PERIOD_PRESETS.includes(rawPreset as PeriodPreset) && rawPreset !== 'custom'
      ? (rawPreset as PeriodPreset)
      : 'quarter';

  const range = custom
    ? // Перепутанные местами даты — не ошибка пользователя, а порядок кликов.
      { from: minDate(from, to), to: maxDate(from, to) }
    : presetRange(preset as Exclude<PeriodPreset, 'custom'>, context);

  const rawGranularity = firstValue(params, 'step');
  const granularityPinned = GRANULARITIES.includes(rawGranularity as Granularity);

  const picked = new Set(
    listValue(params, 'kinds').filter(
      (kind) => isEventKind(kind) && FILTER_KINDS.includes(kind),
    ),
  );

  return {
    preset,
    from: range.from,
    to: range.to,
    granularity: granularityPinned
      ? (rawGranularity as Granularity)
      : defaultGranularity(range.from, range.to),
    userIds: [...new Set(listValue(params, 'users'))],
    // Пустой или испорченный список типов означает «все»: пустой дашборд
    // по кривой ссылке выглядел бы поломкой приложения. Порядок — всегда
    // порядок `EVENT_KINDS`, а типы вне фильтра (выплаты) включены всегда.
    kinds: EVENT_KINDS.filter(
      (kind) => picked.size === 0 || picked.has(kind) || !FILTER_KINDS.includes(kind),
    ),
    granularityPinned,
  };
}

/**
 * Фильтры обратно в адрес.
 *
 * Значения по умолчанию не пишутся: чистый `/dashboard` должен оставаться
 * чистым, а ссылка — короткой и читаемой.
 */
export function dashboardQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams();

  if (filters.preset === 'custom') {
    params.set('from', filters.from);
    params.set('to', filters.to);
  } else if (filters.preset !== 'quarter') {
    params.set('period', filters.preset);
  }

  if (filters.granularityPinned) params.set('step', filters.granularity);
  if (filters.userIds.length > 0) params.set('users', filters.userIds.join(','));
  const kinds = filters.kinds.filter((kind) => FILTER_KINDS.includes(kind));
  if (kinds.length !== FILTER_KINDS.length) params.set('kinds', kinds.join(','));

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/** Адрес дашборда с изменённой частью фильтров. */
export function dashboardHref(
  filters: DashboardFilters,
  patch: Partial<DashboardFilters>,
  basePath = '/dashboard',
): string {
  return `${basePath}${dashboardQuery({ ...filters, ...patch })}`;
}

/**
 * Ключ корзины для шага сетки: дата → начало дня, недели или месяца.
 * Одна функция на ленту и на график — иначе они разъехались бы по границам.
 */
export function bucketKeyOf(granularity: Granularity): (date: IsoDate) => IsoDate {
  if (granularity === 'day') return (date) => date;
  if (granularity === 'week') return startOfWeek;
  return (date) => `${monthOf(date)}-01`;
}

// ─── Фильтры таблицы взносов (§6.3) ────────────────────────────────────────

const CONTRIBUTION_STATUSES = ['PENDING', 'CONFIRMED', 'RECORDED', 'REJECTED'] as const;

export type ContributionStatusFilter = (typeof CONTRIBUTION_STATUSES)[number];

export type ContributionFilters = {
  userId: string | null;
  status: ContributionStatusFilter | null;
  from: IsoDate | null;
  to: IsoDate | null;
};

export const EMPTY_CONTRIBUTION_FILTERS: ContributionFilters = {
  userId: null,
  status: null,
  from: null,
  to: null,
};

/**
 * Фильтры таблицы взносов из адреса страницы.
 *
 * Форма отбора — обычная `<form method="get">`, поэтому состояние экрана целиком
 * лежит в адресе: ссылкой на отфильтрованную таблицу можно поделиться, и никакой
 * клиентский компонент для этого не нужен.
 */
export function parseContributionFilters(params: RawParams): ContributionFilters {
  const userId = firstValue(params, 'user');
  const status = firstValue(params, 'status');
  const from = readDate(params, 'from');
  const to = readDate(params, 'to');

  const valid = CONTRIBUTION_STATUSES.includes(status as ContributionStatusFilter);
  // Перепутанные местами даты — порядок кликов, а не ошибка: молча меняем.
  const swap = from !== null && to !== null && compareDates(from, to) > 0;

  return {
    userId: userId === undefined || userId === '' ? null : userId,
    status: valid ? (status as ContributionStatusFilter) : null,
    from: swap ? to : from,
    to: swap ? from : to,
  };
}

/** Задан ли хотя бы один фильтр — от этого зависит кнопка «Сбросить». */
export function hasContributionFilters(filters: ContributionFilters): boolean {
  return (
    filters.userId !== null ||
    filters.status !== null ||
    filters.from !== null ||
    filters.to !== null
  );
}

/** Сколько дней в периоде, включительно с обеих сторон. */
export function periodDays(filters: { from: IsoDate; to: IsoDate }): number {
  return Math.max(0, toEpochDay(filters.to) - toEpochDay(filters.from) + 1);
}

/** Попадает ли дата в период фильтров (обе границы включительно). */
export function withinPeriod(date: IsoDate, filters: { from: IsoDate; to: IsoDate }): boolean {
  return compareDates(date, filters.from) >= 0 && compareDates(date, filters.to) <= 0;
}
