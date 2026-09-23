'use client';

import type { ReactNode } from 'react';

import { EVENT_COLOR, describeEvent } from '@/components/event-style';
import { PlotTip, useFrameWidth, usePlotHover, useScrollToEnd } from '@/components/charts/plot-frame';
import type { IsoDate } from '@/lib/calc/types';
import { formatDate, formatMonthShort, fullName, type NamedUser } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import {
  bandLayout,
  labelStride,
  linearScale,
  niceDomain,
  stepAreaPath,
  stepPath,
} from '@/lib/view/chart';
import type { TimelineEvent } from '@/lib/view/events';
import type { Granularity } from '@/lib/view/filters';
import { zeroCrossings, type BalanceSeries } from '@/lib/view/series';

/**
 * Остаток фонда за выбранный период (§6.9).
 *
 * Ступени вниз на заказах, вверх на взносах — именно ступени, а не наклонная
 * линия: между операциями остаток не «плавно снижается», он стоит на месте,
 * и наклон был бы враньём.
 *
 * Пересечение нуля выделено: тёплая полоса под нулевой линией и отметки в
 * точках перехода. Цвет здесь не единственный носитель — рядом стоит подпись.
 *
 * График занимает всю ширину карточки в настоящих пикселях: шаги
 * растягиваются, сколько бы их ни было, а шрифт остаётся 11px на любом
 * экране (`plot-frame.tsx`). Если шагов так много, что ступень выходит уже
 * `MIN_BAND`, график листается вбок и открывается на свежем конце.
 *
 * При наведении или касании ступени всплывает её карточка: остаток на конец
 * шага, изменение за шаг и операции, которые его сдвинули, — кто внёс, кто
 * оформил заказ. `steps` необязателен: без него подсказка показывает только
 * остаток и изменение.
 *
 * Один ряд — одна шкала. Второй оси у графика нет и не будет: совмещение
 * двух разномасштабных величин на одной картинке выдумывает связь, которой
 * в данных нет. Балансы участников — отдельным графиком ниже.
 */

/** Ширина до первого замера; на сервере график рисуется на ней. */
const FALLBACK_WIDTH = 760;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 64 };
/** Уже ступень не становится — дальше график листается. */
const MIN_BAND = 4;
/** Место под одну подпись оси вместе с зазором. */
const LABEL_WIDTH = 52;

/** Сколько операций перечислять в подсказке ступени, прежде чем свернуть. */
const STEP_EVENTS_SHOWN = 6;

/** Подпись шага и операции, из которых он сложился. Идёт параллельно `series.points`. */
export type BalanceStep = { title: string; events: readonly TimelineEvent[] };

export function FundBalanceChart({
  series,
  granularity,
  steps,
  people = new Map(),
}: {
  series: BalanceSeries;
  granularity: Granularity;
  steps?: readonly BalanceStep[];
  people?: ReadonlyMap<string, NamedUser>;
}): ReactNode {
  const { points } = series;
  const { ref, frame, width: frameWidth } = useFrameWidth(FALLBACK_WIDTH);

  const layout = bandLayout(
    points.length,
    frameWidth - PADDING.left - PADDING.right,
    MIN_BAND,
  );
  const width = PADDING.left + layout.plotWidth + PADDING.right;
  const { scrollRef, scrollLeft, onScroll } = useScrollToEnd(width, layout.scrolls);
  const hover = usePlotHover({
    count: points.length,
    left: PADDING.left,
    band: layout.band,
    container: frame,
  });

  if (points.length === 0) {
    return <p className="text-muted-foreground text-sm">За период движения денег не было.</p>;
  }

  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const { domain, ticks } = niceDomain(
    points.map((point) => point.balance),
    4,
  );
  const y = linearScale(domain, [PADDING.top + plotHeight, PADDING.top]);

  const centerX = (index: number): number => PADDING.left + layout.band * (index + 0.5);

  const geometry = points.map((point, index) => ({ x: centerX(index), y: y(point.balance) }));
  const crossings = zeroCrossings(points);
  const belowZero = series.min < 0;

  const last = points[points.length - 1]!;
  const lastPoint = geometry[geometry.length - 1]!;

  const labelEvery = labelStride(points.length, layout.band, LABEL_WIDTH);
  const formatKey = (key: IsoDate): string =>
    granularity === 'month' ? formatMonthShort(key.slice(0, 7)) : formatDate(key).slice(0, 5);

  const active = hover.active;
  const activePoint = active === null ? undefined : points[active];
  const activeGeometry = active === null ? undefined : geometry[active];

  return (
    <figure className="plot-surface m-0 p-2">
      <div ref={ref} className="relative">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={layout.scrolls ? 'overflow-x-auto overscroll-x-contain' : undefined}
        >
          <svg
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Остаток фонда за период: от ${formatKopecks(series.startBalance)} до ${formatKopecks(last.balance)}. Стрелки влево и вправо переходят по шагам.`}
            className="block touch-manipulation select-none outline-none focus-visible:ring-ring/50 focus-visible:ring-2 rounded-sm"
            {...hover.svgProps}
          >
            {/* Территория ниже нуля — фонд в долгу. Полоса рисуется под данными. */}
            {belowZero && (
              <rect
                x={PADDING.left}
                y={y(0)}
                width={layout.plotWidth}
                height={Math.max(0, PADDING.top + plotHeight - y(0))}
                fill="var(--owes)"
                fillOpacity={0.08}
              />
            )}

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + layout.plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 && belowZero ? 'var(--owes)' : 'var(--chart-grid)'}
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="tabular fill-muted-foreground text-[11px]"
                >
                  {formatKopecks(tick, { withSymbol: false })}
                </text>
              </g>
            ))}

            <path
              d={stepAreaPath(geometry, y(Math.max(domain[0], 0)))}
              fill="var(--chart-1)"
              fillOpacity={0.1}
            />
            <path
              d={stepPath(geometry)}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {crossings.map((index) => (
              <circle
                key={`crossing-${index}`}
                cx={geometry[index]!.x}
                cy={geometry[index]!.y}
                r={5}
                fill="var(--owes)"
                stroke="var(--chart-surface)"
                strokeWidth={2}
              >
                <title>{`${formatDate(points[index]!.date)}: фонд пересёк ноль, остаток ${formatKopecks(points[index]!.balance)}`}</title>
              </circle>
            ))}

            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={4}
              fill="var(--chart-1)"
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
            {/* Подпись уходит влево от точки: справа край картинки, текст обрезало бы. */}
            <text
              x={lastPoint.x - 8}
              y={Math.max(lastPoint.y - 8, PADDING.top + 10)}
              textAnchor="end"
              className="tabular fill-foreground text-[11px] font-medium"
            >
              {formatKopecks(last.balance)}
            </text>

            {points.map((point, index) =>
              index % labelEvery === 0 ? (
                <text
                  key={point.date}
                  x={centerX(index)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatKey(point.date)}
                </text>
              ) : null,
            )}

            {activeGeometry !== undefined && (
              <g pointerEvents="none">
                <line
                  x1={activeGeometry.x}
                  x2={activeGeometry.x}
                  y1={PADDING.top}
                  y2={PADDING.top + plotHeight}
                  stroke="var(--foreground)"
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={activeGeometry.x}
                  cy={activeGeometry.y}
                  r={4.5}
                  fill="var(--chart-1)"
                  stroke="var(--chart-surface)"
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Прозрачная подложка ловит курсор и палец по всей области данных. */}
            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={layout.plotWidth}
              height={plotHeight}
              fill="transparent"
              className="cursor-crosshair"
            />
          </svg>
        </div>

        {active !== null && activePoint !== undefined && activeGeometry !== undefined && (
          <PlotTip x={activeGeometry.x - scrollLeft} frameWidth={frameWidth}>
            <StepTip
              step={steps?.[active] ?? { title: formatKey(activePoint.date), events: [] }}
              balance={activePoint.balance}
              change={
                activePoint.balance -
                (active === 0 ? series.startBalance : points[active - 1]!.balance)
              }
              people={people}
            />
          </PlotTip>
        )}
      </div>

      <figcaption className="text-muted-foreground mt-2 text-xs">
        Остаток на начало периода — {formatKopecks(series.startBalance)}, на конец —{' '}
        {formatKopecks(last.balance)}.{' '}
        {belowZero
          ? 'Тёплая полоса — область ниже нуля: там фонд в долгу.'
          : 'Ниже нуля фонд за этот период не уходил.'}
        {layout.scrolls && ' График не поместился целиком — листается вбок.'}
      </figcaption>
    </figure>
  );
}

/** Карточка ступени: остаток, изменение за шаг и операции, которые его дали. */
function StepTip({
  step,
  balance,
  change,
  people,
}: {
  step: BalanceStep;
  balance: number;
  change: number;
  people: ReadonlyMap<string, NamedUser>;
}): ReactNode {
  const shown = step.events.slice(0, STEP_EVENTS_SHOWN);
  const hidden = step.events.length - shown.length;

  return (
    <div className="flex min-w-52 flex-col gap-1.5">
      <p className="font-semibold">{step.title}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        <dt className="text-muted-foreground">Остаток</dt>
        <dd className="tabular text-right">{formatKopecks(balance)}</dd>
        <dt className="text-muted-foreground">Изменение</dt>
        <dd className="tabular text-right">
          {change === 0 ? 'без движения' : formatKopecks(change, { alwaysSign: true })}
        </dd>
      </dl>
      {shown.length > 0 && (
        <ul className="border-border flex flex-col gap-1 border-t pt-1.5">
          {shown.map((event) => {
            const { title } = describeEvent(event, people);
            const actor =
              event.actorId === null || event.actorId === undefined
                ? undefined
                : people.get(event.actorId);
            return (
              <li key={event.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 inline-block size-2 shrink-0 rounded-full"
                  style={{ background: EVENT_COLOR[event.kind] }}
                />
                <span className="min-w-0">
                  {title}
                  {actor !== undefined && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {event.kind === 'ORDER' ? 'оформил' : 'провёл'} {fullName(actor)}
                    </span>
                  )}
                  <span className="text-muted-foreground tabular"> · {formatDate(event.startsOn)}</span>
                </span>
              </li>
            );
          })}
          {hidden > 0 && <li className="text-muted-foreground">и ещё {hidden}</li>}
        </ul>
      )}
    </div>
  );
}
