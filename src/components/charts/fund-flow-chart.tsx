'use client';

import type { ReactNode } from 'react';

import { PlotTip, useFrameWidth, usePlotHover, useScrollToEnd } from '@/components/charts/plot-frame';
import type { IsoDate } from '@/lib/calc/types';
import type { FundFlowStat } from '@/lib/data';
import { formatDate, formatMonthShort } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import {
  bandLayout,
  bandWidth,
  labelStride,
  linearScale,
  niceDomain,
  stepAreaPath,
  stepPath,
} from '@/lib/view/chart';
import { bucketTitle } from '@/lib/view/filters';

/**
 * Динамика фонда по месяцам или неделям (§6.4).
 *
 * Два графика, а не один с двумя осями: поступления и траты — это движение
 * за шаг, а остаток — состояние на его конец. Совмещать разные по смыслу
 * величины на одной шкале значит выдумывать связь, которой в данных нет;
 * поэтому здесь две панели с общей осью шагов и каждая со своей шкалой.
 *
 * Шаги растянуты на всю ширину карточки в настоящих пикселях: четыре месяца
 * истории — четыре широкие полосы на весь экран, а не четыре столбика у края.
 * Если шагов больше, чем помещается при `MIN_BAND` на шаг (полгода недель
 * на телефоне), график листается вбок и открывается на свежем конце.
 *
 * При наведении или касании шага всплывает карточка с тремя числами шага.
 * Все числа продублированы таблицей под графиком: значение никогда не
 * доступно только через наведение.
 */

export type FlowStep = 'month' | 'week';

/** Ширина до первого замера; на сервере график рисуется на ней. */
const FALLBACK_WIDTH = 760;
const FLOW_HEIGHT = 140;
const BALANCE_HEIGHT = 96;
const GAP = 44;
const PADDING = { top: 16, right: 16, bottom: 26, left: 64 };
/** Уже полоса не становится — дальше график листается. */
const MIN_BAND = 18;
/** Место под одну подпись оси вместе с зазором. */
const LABEL_WIDTH = 52;

/** Короткая подпись шага на оси. */
function axisLabel(start: IsoDate, step: FlowStep): string {
  return step === 'month' ? formatMonthShort(start.slice(0, 7)) : formatDate(start).slice(0, 5);
}

export function FundFlowChart({
  stats,
  step = 'month',
}: {
  stats: readonly FundFlowStat[];
  step?: FlowStep;
}): ReactNode {
  const { ref, frame, width: frameWidth } = useFrameWidth(FALLBACK_WIDTH);
  const layout = bandLayout(stats.length, frameWidth - PADDING.left - PADDING.right, MIN_BAND);
  const width = PADDING.left + layout.plotWidth + PADDING.right;
  const { scrollRef, scrollLeft, onScroll } = useScrollToEnd(width, layout.scrolls);
  const hover = usePlotHover({
    count: stats.length,
    left: PADDING.left,
    band: layout.band,
    container: frame,
  });

  if (stats.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Пока нечего показывать: ни одного шага с движением денег.
      </p>
    );
  }

  const height = PADDING.top + FLOW_HEIGHT + GAP + BALANCE_HEIGHT + PADDING.bottom;
  const plotWidth = layout.plotWidth;

  const flowTop = PADDING.top;
  const balanceTop = PADDING.top + FLOW_HEIGHT + GAP;

  const flow = niceDomain(
    stats.flatMap((stat) => [stat.contributions, stat.orders]),
    3,
  );
  const flowScale = linearScale(flow.domain, [flowTop + FLOW_HEIGHT, flowTop]);

  const balance = niceDomain(
    stats.map((stat) => stat.endBalance),
    2,
  );
  const balanceScale = linearScale(balance.domain, [balanceTop + BALANCE_HEIGHT, balanceTop]);

  // Столбик — шесть десятых полосы, но не толще 48px: широкий столбик на
  // четырёх месяцах читается как заливка, а не как величина.
  const barWidth = bandWidth(stats.length, plotWidth, layout.band * 0.4, 48);
  const centerX = (index: number): number => PADDING.left + layout.band * (index + 0.5);

  const balancePoints = stats.map((stat, index) => ({
    x: centerX(index),
    y: balanceScale(stat.endBalance),
  }));

  const labelEvery = labelStride(stats.length, layout.band, LABEL_WIDTH);
  const lastStat = stats[stats.length - 1]!;
  const lastPoint = balancePoints[balancePoints.length - 1]!;
  const crossesZero = stats.some((stat) => stat.endBalance < 0);

  const active = hover.active;
  const activeStat = active === null ? undefined : stats[active];

  return (
    <figure className="plot-surface m-0 p-2">
      <div ref={ref} className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={layout.scrolls ? 'overflow-x-auto overscroll-x-contain' : undefined}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label={`Поступления и траты по ${step === 'month' ? 'месяцам' : 'неделям'}, под ними остаток фонда на конец шага. Стрелки влево и вправо переходят по шагам.`}
            className="focus-visible:ring-ring/50 block touch-manipulation rounded-sm outline-none select-none focus-visible:ring-2"
            {...hover.svgProps}
          >
            {/* Подсветка выбранного шага — под данными, во всю высоту обеих панелей. */}
            {active !== null && (
              <rect
                x={PADDING.left + layout.band * active}
                y={flowTop}
                width={layout.band}
                height={balanceTop + BALANCE_HEIGHT - flowTop}
                fill="var(--foreground)"
                fillOpacity={0.06}
                rx={4}
              />
            )}

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

            {stats.map((stat, index) => {
              const x = centerX(index) - barWidth / 2;
              const zero = flowScale(0);
              const inTop = flowScale(stat.contributions);
              const outBottom = flowScale(stat.orders);

              return (
                <g key={`bars-${stat.start}`}>
                  {stat.contributions !== 0 && (
                    <rect
                      x={x}
                      y={inTop}
                      width={barWidth}
                      height={Math.max(1, zero - inTop)}
                      rx={3}
                      fill="var(--credit)"
                    />
                  )}
                  {stat.orders !== 0 && (
                    <rect
                      x={x}
                      y={zero}
                      width={barWidth}
                      height={Math.max(1, outBottom - zero)}
                      rx={3}
                      fill="var(--owes)"
                    />
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
            {active !== null && (
              <circle
                cx={balancePoints[active]!.x}
                cy={balancePoints[active]!.y}
                r={4.5}
                fill="var(--chart-1)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}

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

            {/* ─── Ось шагов ───────────────────────────────────────────────── */}
            {stats.map((stat, index) =>
              index % labelEvery === 0 ? (
                <text
                  key={`axis-${stat.start}`}
                  x={centerX(index)}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {axisLabel(stat.start, step)}
                </text>
              ) : null,
            )}

            {/* Прозрачная подложка ловит курсор и палец по всей высоте панелей. */}
            <rect
              x={PADDING.left}
              y={flowTop}
              width={plotWidth}
              height={balanceTop + BALANCE_HEIGHT - flowTop}
              fill="transparent"
              className="cursor-crosshair"
            />
          </svg>
        </div>

        {active !== null && activeStat !== undefined && (
          <PlotTip x={centerX(active) - scrollLeft} frameWidth={frameWidth}>
            <div className="flex min-w-44 flex-col gap-1.5">
              <p className="font-semibold">{bucketTitle(activeStat.start, step)}</p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <span aria-hidden className="bg-credit inline-block size-2 rounded-sm" />
                  Поступило
                </dt>
                <dd className="tabular text-right">{formatKopecks(activeStat.contributions)}</dd>
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <span aria-hidden className="bg-owes inline-block size-2 rounded-sm" />
                  Потрачено
                </dt>
                <dd className="tabular text-right">{formatKopecks(activeStat.orders)}</dd>
                <dt className="text-muted-foreground flex items-center gap-1.5">
                  <span aria-hidden className="bg-chart-1 inline-block h-0.5 w-2 rounded-sm" />
                  Остаток на конец
                </dt>
                <dd className="tabular text-right font-medium">
                  {formatKopecks(activeStat.endBalance)}
                </dd>
              </dl>
            </div>
          </PlotTip>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-credit inline-block h-2 w-4 rounded-sm" />
          Поступило за {step === 'month' ? 'месяц' : 'неделю'}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-owes inline-block h-2 w-4 rounded-sm" />
          Потрачено за {step === 'month' ? 'месяц' : 'неделю'}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-chart-1 inline-block h-0.5 w-4 rounded-sm" />
          Остаток на конец {step === 'month' ? 'месяца' : 'недели'}
        </span>
        {layout.scrolls && (
          <span className="text-muted-foreground">Не поместилось целиком — листается вбок</span>
        )}
      </figcaption>
    </figure>
  );
}
