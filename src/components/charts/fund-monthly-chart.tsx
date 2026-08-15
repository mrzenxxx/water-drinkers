import type { ReactNode } from 'react';

import type { MonthlyStat } from '@/lib/data';
import { formatMonth, formatMonthShort } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import {
  bandCenter,
  bandWidth,
  chartBox,
  linearScale,
  niceDomain,
  stepAreaPath,
  stepPath,
} from '@/lib/view/chart';

/**
 * Динамика фонда по месяцам (§6.4).
 *
 * Два графика, а не один с двумя осями: поступления и траты — это движение
 * за месяц, а остаток — состояние на его конец. Совмещать разные по смыслу
 * величины на одной шкале значит выдумывать связь, которой в данных нет;
 * поэтому здесь две панели с общей осью месяцев и каждая со своей шкалой.
 *
 * Рисуется на сервере встроенным SVG: клиентская библиотека ради двух рядов
 * прямоугольников утянула бы в бандл десятки килобайт и потребовала бы
 * `'use client'` там, где нет ни одного обработчика. Подсказка при наведении
 * сделана элементом `<title>` — её показывает сам браузер, без JavaScript.
 * Все числа продублированы таблицей под графиком: значение никогда не
 * доступно только через наведение.
 */

/** Больше двух лет помесячно на одной картинке уже не читается. */
const MAX_MONTHS = 24;

const WIDTH = 760;
const FLOW_HEIGHT = 140;
const BALANCE_HEIGHT = 96;
const GAP = 44;
const PADDING = { top: 16, right: 16, bottom: 26, left: 76 };

export function FundMonthlyChart({ stats }: { stats: readonly MonthlyStat[] }): ReactNode {
  const shown = stats.slice(-MAX_MONTHS);

  if (shown.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Пока нечего показывать: ни одного месяца с движением денег.
      </p>
    );
  }

  const height = PADDING.top + FLOW_HEIGHT + GAP + BALANCE_HEIGHT + PADDING.bottom;
  const box = chartBox(WIDTH, height, PADDING);
  const plotWidth = box.plot.width;

  const flowTop = PADDING.top;
  const balanceTop = PADDING.top + FLOW_HEIGHT + GAP;

  const flow = niceDomain(
    shown.flatMap((stat) => [stat.contributions, stat.orders]),
    3,
  );
  const flowScale = linearScale(flow.domain, [flowTop + FLOW_HEIGHT, flowTop]);

  const balance = niceDomain(
    shown.map((stat) => stat.endBalance),
    2,
  );
  const balanceScale = linearScale(balance.domain, [balanceTop + BALANCE_HEIGHT, balanceTop]);

  const barWidth = bandWidth(shown.length, plotWidth, 6, 22);
  const centerX = (index: number): number =>
    bandCenter(index, shown.length, plotWidth, PADDING.left);

  const balancePoints = shown.map((stat, index) => ({
    x: centerX(index),
    y: balanceScale(stat.endBalance),
  }));

  // Подписи месяцев прореживаются: двадцать четыре надписи в ряд слипаются.
  const labelEvery = Math.ceil(shown.length / 8);
  const lastStat = shown[shown.length - 1]!;
  const lastPoint = balancePoints[balancePoints.length - 1]!;
  const crossesZero = shown.some((stat) => stat.endBalance < 0);

  return (
    <figure className="plot-surface m-0 p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="img"
        aria-label="Поступления и траты по месяцам, под ними остаток фонда на конец месяца"
        className="block h-auto w-full"
      >
        {/* ─── Панель движений ─────────────────────────────────────────── */}
        {flow.ticks.map((tick) => (
          <g key={`flow-${tick}`}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={flowScale(tick)}
              y2={flowScale(tick)}
              stroke={tick === 0 ? 'var(--muted-foreground)' : 'var(--chart-grid)'}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={flowScale(tick) + 4}
              textAnchor="end"
              className="tabular fill-muted-foreground text-[11px]"
            >
              {formatKopecks(tick, { withSymbol: false })}
            </text>
          </g>
        ))}

        {shown.map((stat, index) => {
          const x = centerX(index) - barWidth / 2;
          const zero = flowScale(0);
          const inTop = flowScale(stat.contributions);
          const outBottom = flowScale(stat.orders);

          return (
            <g key={`bars-${stat.month}`}>
              {stat.contributions !== 0 && (
                <rect
                  x={x}
                  y={inTop}
                  width={barWidth}
                  height={Math.max(1, zero - inTop)}
                  rx={3}
                  fill="var(--credit)"
                >
                  <title>{`${formatMonth(stat.month)}: поступило ${formatKopecks(stat.contributions)}`}</title>
                </rect>
              )}
              {stat.orders !== 0 && (
                <rect
                  x={x}
                  y={zero}
                  width={barWidth}
                  height={Math.max(1, outBottom - zero)}
                  rx={3}
                  fill="var(--owes)"
                >
                  <title>{`${formatMonth(stat.month)}: потрачено ${formatKopecks(-stat.orders)}`}</title>
                </rect>
              )}
            </g>
          );
        })}

        {/* ─── Панель остатка ──────────────────────────────────────────── */}
        {balance.ticks.map((tick) => (
          <g key={`balance-${tick}`}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={balanceScale(tick)}
              y2={balanceScale(tick)}
              stroke={tick === 0 && crossesZero ? 'var(--owes)' : 'var(--chart-grid)'}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={balanceScale(tick) + 4}
              textAnchor="end"
              className="tabular fill-muted-foreground text-[11px]"
            >
              {formatKopecks(tick, { withSymbol: false })}
            </text>
          </g>
        ))}

        <path
          d={stepAreaPath(balancePoints, balanceScale(Math.max(balance.domain[0], 0)))}
          fill="var(--chart-1)"
          fillOpacity={0.1}
        />
        <path
          d={stepPath(balancePoints)}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={4}
          fill="var(--chart-1)"
          stroke="var(--chart-surface)"
          strokeWidth={2}
        />

        {/*
          Подписывается только конец ряда: число на каждой точке не читают.
          Подпись уходит влево от точки — справа от неё край картинки,
          и текст оказался бы обрезан.
        */}
        <text
          x={lastPoint.x - 8}
          y={Math.max(lastPoint.y - 8, balanceTop + 10)}
          textAnchor="end"
          className="tabular fill-foreground text-[11px] font-medium"
        >
          {formatKopecks(lastStat.endBalance)}
        </text>

        {/* ─── Ось месяцев ─────────────────────────────────────────────── */}
        {shown.map((stat, index) =>
          index % labelEvery === 0 || index === shown.length - 1 ? (
            <text
              key={`axis-${stat.month}`}
              x={centerX(index)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatMonthShort(stat.month)}
            </text>
          ) : null,
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-credit inline-block h-2 w-4 rounded-sm" />
          Поступило за месяц
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-owes inline-block h-2 w-4 rounded-sm" />
          Потрачено за месяц
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-chart-1 inline-block h-0.5 w-4 rounded-sm" />
          Остаток на конец месяца
        </span>
      </figcaption>
    </figure>
  );
}
