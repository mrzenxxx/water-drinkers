import { describe, expect, it } from 'vitest';

import { EVENT_KINDS } from '@/lib/view/events';
import {
  bucketKeyOf,
  dashboardHref,
  dashboardQuery,
  defaultGranularity,
  FILTER_KINDS,
  hasContributionFilters,
  parseContributionFilters,
  parseDashboardFilters,
  periodDays,
  presetRange,
  withinPeriod,
  type DashboardFilters,
} from '@/lib/view/filters';

const CONTEXT = { today: '2026-08-14', earliest: '2026-01-15' };

describe('быстрые периоды', () => {
  it('кончаются сегодняшним днём и не съезжают на длине месяца', () => {
    expect(presetRange('month', CONTEXT)).toEqual({ from: '2026-07-15', to: '2026-08-14' });
    expect(presetRange('quarter', CONTEXT)).toEqual({ from: '2026-05-15', to: '2026-08-14' });
    expect(presetRange('year', CONTEXT)).toEqual({ from: '2025-08-15', to: '2026-08-14' });
  });

  it('«всё время» начинается с самой ранней известной даты', () => {
    expect(presetRange('all', CONTEXT)).toEqual({ from: '2026-01-15', to: '2026-08-14' });
  });

  it('не даёт отрицательный период, если ранняя дата в будущем', () => {
    const range = presetRange('all', { today: '2026-01-01', earliest: '2026-05-01' });
    expect(periodDays(range)).toBe(1);
  });
});

describe('разбор адреса дашборда', () => {
  it('по умолчанию берёт квартал и все типы событий', () => {
    const filters = parseDashboardFilters({}, CONTEXT);
    expect(filters.preset).toBe('quarter');
    expect(filters.kinds).toEqual([...EVENT_KINDS]);
    expect(filters.userIds).toEqual([]);
    expect(filters.granularityPinned).toBe(false);
  });

  it('пара дат сильнее ярлыка периода', () => {
    const filters = parseDashboardFilters(
      { period: 'year', from: '2026-03-01', to: '2026-03-31' },
      CONTEXT,
    );
    expect(filters.preset).toBe('custom');
    expect(filters).toMatchObject({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('меняет местами перепутанные даты', () => {
    const filters = parseDashboardFilters({ from: '2026-03-31', to: '2026-03-01' }, CONTEXT);
    expect(filters).toMatchObject({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('не падает на мусоре и не оставляет экран пустым', () => {
    const filters = parseDashboardFilters(
      { period: 'вчера', from: '31.03.2026', step: 'час', kinds: 'ЧТО-ТО', users: '' },
      CONTEXT,
    );
    expect(filters.preset).toBe('quarter');
    expect(filters.kinds).toEqual([...EVENT_KINDS]);
    expect(filters.userIds).toEqual([]);
  });

  it('принимает типы и участников списком и повторённым параметром', () => {
    const filters = parseDashboardFilters(
      { kinds: 'ORDER,CONTRIBUTION,ORDER', users: ['a', 'b,c'] },
      CONTEXT,
    );
    expect(filters.kinds).toEqual(['CONTRIBUTION', 'ORDER', 'SETTLEMENT']);
    expect(filters.userIds).toEqual(['a', 'b', 'c']);
  });

  it('выплаты в фильтре не выбираются и показываются всегда', () => {
    expect(FILTER_KINDS).not.toContain('SETTLEMENT');

    const narrowed = parseDashboardFilters({ kinds: 'ABSENCE' }, CONTEXT);
    expect(narrowed.kinds).toEqual(['ABSENCE', 'SETTLEMENT']);

    // Старая ссылка «только выплаты» — это ничего не выбрано, то есть всё.
    const legacy = parseDashboardFilters({ kinds: 'SETTLEMENT' }, CONTEXT);
    expect(legacy.kinds).toEqual([...EVENT_KINDS]);
  });

  it('все типы фильтра, выбранные явно, в адрес не пишутся', () => {
    const all = parseDashboardFilters({ kinds: FILTER_KINDS.join(',') }, CONTEXT);
    expect(dashboardQuery(all)).toBe('');
  });

  it('подбирает шаг по длине периода, пока его не задали', () => {
    expect(defaultGranularity('2026-06-01', '2026-06-30')).toBe('day');
    expect(defaultGranularity('2026-01-01', '2026-06-30')).toBe('week');
    expect(defaultGranularity('2020-01-01', '2026-06-30')).toBe('month');

    const pinned = parseDashboardFilters({ period: 'year', step: 'day' }, CONTEXT);
    expect(pinned.granularity).toBe('day');
    expect(pinned.granularityPinned).toBe(true);
  });
});

describe('сборка адреса', () => {
  const base = parseDashboardFilters({}, CONTEXT);

  it('умолчания в адрес не пишет', () => {
    expect(dashboardQuery(base)).toBe('');
  });

  it('произвольный период уходит в адрес датами', () => {
    const custom = parseDashboardFilters({ from: '2026-03-01', to: '2026-03-31' }, CONTEXT);
    expect(dashboardQuery(custom)).toBe('?from=2026-03-01&to=2026-03-31');
  });

  it('переживает круг «разобрать → собрать → разобрать»', () => {
    const filters: DashboardFilters = {
      ...base,
      preset: 'year',
      granularity: 'week',
      granularityPinned: true,
      userIds: ['u-1', 'u-2'],
      kinds: ['ORDER', 'ABSENCE'],
    };

    const query = dashboardQuery(filters);
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));
    const again = parseDashboardFilters(params, CONTEXT);

    expect(again.preset).toBe('year');
    expect(again.granularity).toBe('week');
    expect(again.userIds).toEqual(['u-1', 'u-2']);
    expect(again.kinds).toEqual(['ORDER', 'ABSENCE', 'SETTLEMENT']);
  });

  it('меняет одну часть фильтров, сохраняя остальные', () => {
    const filters: DashboardFilters = { ...base, userIds: ['u-1'] };
    expect(dashboardHref(filters, { preset: 'month' })).toBe('/dashboard?period=month&users=u-1');
  });
});

describe('корзины и границы периода', () => {
  it('день остаётся собой, неделя сдвигается к понедельнику, месяц — к первому числу', () => {
    expect(bucketKeyOf('day')('2026-06-10')).toBe('2026-06-10');
    expect(bucketKeyOf('week')('2026-06-10')).toBe('2026-06-08');
    expect(bucketKeyOf('month')('2026-06-10')).toBe('2026-06-01');
  });

  it('считает длину периода включительно', () => {
    expect(periodDays({ from: '2026-06-01', to: '2026-06-01' })).toBe(1);
    expect(periodDays({ from: '2026-06-01', to: '2026-06-30' })).toBe(30);
  });

  it('включает обе границы', () => {
    const range = { from: '2026-06-01', to: '2026-06-30' };
    expect(withinPeriod('2026-06-01', range)).toBe(true);
    expect(withinPeriod('2026-06-30', range)).toBe(true);
    expect(withinPeriod('2026-05-31', range)).toBe(false);
  });
});

describe('фильтры таблицы взносов', () => {
  it('пустой адрес — пустые фильтры', () => {
    const filters = parseContributionFilters({});
    expect(filters).toEqual({ userId: null, status: null, from: null, to: null });
    expect(hasContributionFilters(filters)).toBe(false);
  });

  it('игнорирует неизвестный статус и кривые даты', () => {
    const filters = parseContributionFilters({ status: 'МОЖЕТ БЫТЬ', from: 'вчера' });
    expect(filters.status).toBeNull();
    expect(filters.from).toBeNull();
  });

  it('читает участника, статус и период', () => {
    const filters = parseContributionFilters({
      user: 'u-1',
      status: 'CONFIRMED',
      from: '2026-06-30',
      to: '2026-06-01',
    });
    // Перепутанные даты меняются местами.
    expect(filters).toEqual({
      userId: 'u-1',
      status: 'CONFIRMED',
      from: '2026-06-01',
      to: '2026-06-30',
    });
    expect(hasContributionFilters(filters)).toBe(true);
  });
});
