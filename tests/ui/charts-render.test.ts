/**
 * Дымовая проверка графиков.
 *
 * Браузера здесь нет, но самая частая поломка встроенного SVG видна и в строке:
 * `NaN` в координате — путь не рисуется вовсе, и на экране просто пусто, без
 * единой ошибки в консоли. Поэтому графики рендерятся в разметку и проверяются
 * на отсутствие `NaN`, `Infinity` и `undefined` в атрибутах.
 *
 * Разметка собирается через `createElement`, а не JSX: файл лежит рядом
 * с остальными тестами ядра, и добавлять ради него `.tsx` в конфигурацию
 * vitest не хочется.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FundBalanceChart } from '@/components/charts/fund-balance-chart';
import { FundFlowChart } from '@/components/charts/fund-flow-chart';
import type { FundFlowStat } from '@/lib/data/fund';
import { ParticipantBalanceChart } from '@/components/charts/participant-balance-chart';
import type { BalanceSeries, ParticipantSeries } from '@/lib/view/series';

const BROKEN = /NaN|Infinity|undefined/;

const STATS: FundFlowStat[] = [
  { start: '2026-06-01', contributions: 400_000, orders: -300_000, endBalance: 100_000 },
  { start: '2026-07-01', contributions: 0, orders: -250_000, endBalance: -150_000 },
  { start: '2026-08-01', contributions: 500_000, orders: 0, endBalance: 350_000 },
];

const SERIES: BalanceSeries = {
  startBalance: 0,
  points: [
    { date: '2026-06-01', balance: 0 },
    { date: '2026-06-08', balance: 200_000 },
    { date: '2026-06-15', balance: -100_000 },
    { date: '2026-06-22', balance: 50_000 },
  ],
  min: -100_000,
  max: 200_000,
  crossesZero: true,
};

describe('график движения фонда', () => {
  it('рисует пути без битых координат', () => {
    const markup = renderToStaticMarkup(createElement(FundFlowChart, { stats: STATS }));
    expect(markup).toContain('<svg');
    expect(markup).toMatch(/d="M/);
    expect(BROKEN.test(markup)).toBe(false);
  });

  it('на пустых данных говорит об этом словами, а не пустым прямоугольником', () => {
    const markup = renderToStaticMarkup(createElement(FundFlowChart, { stats: [] }));
    expect(markup).not.toContain('<svg');
    expect(markup).toContain('Пока нечего показывать');
  });
});

describe('график остатка фонда', () => {
  it('рисует ступени и отмечает переход через ноль', () => {
    const markup = renderToStaticMarkup(
      createElement(FundBalanceChart, { series: SERIES, granularity: 'week' }),
    );
    expect(markup).toContain('<svg');
    // Ступень — горизонталь и вертикаль, а не наклонная линия.
    expect(markup).toMatch(/d="M[^"]*H[^"]*V/);
    expect(markup).toContain('фонд пересёк ноль');
    expect(BROKEN.test(markup)).toBe(false);
  });

  it('без точек не рисует пустую картинку', () => {
    const empty: BalanceSeries = {
      startBalance: 0,
      points: [],
      min: 0,
      max: 0,
      crossesZero: false,
    };
    const markup = renderToStaticMarkup(
      createElement(FundBalanceChart, { series: empty, granularity: 'day' }),
    );
    expect(markup).not.toContain('<svg');
  });
});

describe('график балансов участников', () => {
  const LINES = [
    { userId: 'u-1', name: 'Анна Петрова', department: 'ГИС', isMe: true },
    { userId: 'u-2', name: 'Иван Сидоров', department: null, isMe: false },
  ];
  const PARTICIPANTS: ParticipantSeries[] = [
    {
      userId: 'u-1',
      startBalance: 0,
      points: [
        { date: '2026-06-01', balance: 50_000, contributed: 50_000, spent: 0 },
        { date: '2026-06-08', balance: -10_000, contributed: 0, spent: 60_000 },
      ],
    },
    {
      userId: 'u-2',
      startBalance: 10_000,
      points: [
        { date: '2026-06-01', balance: 10_000, contributed: 0, spent: 0 },
        { date: '2026-06-08', balance: 5_000, contributed: 0, spent: 5_000 },
      ],
    },
  ];

  it('рисует линию на каждого участника и легенду с именами', () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantBalanceChart, {
        series: PARTICIPANTS,
        lines: LINES,
        granularity: 'week',
        titles: ['Неделя с 01.06.2026', 'Неделя с 08.06.2026'],
      }),
    );
    expect(markup.match(/<path d="M[^"]*H[^"]*V/g)).toHaveLength(2);
    expect(markup).toContain('Анна Петрова');
    expect(markup).toContain('Иван Сидоров');
    expect(BROKEN.test(markup)).toBe(false);
  });

  it('без выбранных участников подсказывает, где их выбрать', () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantBalanceChart, {
        series: [],
        lines: [],
        granularity: 'week',
        titles: [],
      }),
    );
    expect(markup).not.toContain('<svg');
    expect(markup).toContain('Выберите участников в фильтре');
  });
});
