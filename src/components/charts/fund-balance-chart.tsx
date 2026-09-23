import type { ReactNode } from 'react';

import { EVENT_COLOR, describeEvent } from '@/components/event-style';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { IsoDate } from '@/lib/calc/types';
import { formatDate, formatMonthShort, fullName, type NamedUser } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import {
  bandCenter,
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
 * При наведении на ступень всплывает её карточка: остаток на конец шага,
 * изменение за шаг и операции, которые его сдвинули, — кто внёс, кто оформил
 * заказ. Слой наведения — прозрачные колонки поверх графика; без них график
 * рисуется как раньше, поэтому `steps` необязателен.
 *
 * Один ряд — одна шкала. Второй оси у графика нет и не будет: совмещение
 * двух разномасштабных величин на одной картинке выдумывает связь, которой
 * в данных нет.
 */

const WIDTH = 760;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 76 };

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

  if (points.length === 0) {
    return <p className="text-muted-foreground text-sm">За период движения денег не было.</p>;
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const { domain, ticks } = niceDomain(
    points.map((point) => point.balance),
    4,
  );
  const y = linearScale(domain, [PADDING.top + plotHeight, PADDING.top]);

  const centerX = (index: number): number =>
    bandCenter(index, points.length, plotWidth, PADDING.left);

  const geometry = points.map((point, index) => ({ x: centerX(index), y: y(point.balance) }));
  const crossings = zeroCrossings(points);
  const belowZero = series.min < 0;

  const last = points[points.length - 1]!;
  const lastPoint = geometry[geometry.length - 1]!;

  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const formatKey = (key: IsoDate): string =>
    granularity === 'month' ? formatMonthShort(key.slice(0, 7)) : formatDate(key).slice(0, 5);

  return (
    <figure className="plot-surface m-0 p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Остаток фонда за период: от ${formatKopecks(series.startBalance)} до ${formatKopecks(last.balance)}`}
        className="block h-auto w-full"
      >
        {/* Территория ниже нуля — фонд в долгу. Полоса рисуется под данными. */}
        {belowZero && (
          <rect
            x={PADDING.left}
            y={y(0)}
            width={plotWidth}
            height={Math.max(0, PADDING.top + plotHeight - y(0))}
            fill="var(--owes)"
            fillOpacity={0.08}
          />
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
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
          index % labelEvery === 0 || index === points.length - 1 ? (
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

        {/* Слой наведения — последним, поверх данных: иначе линия и точки
            перехватывали бы курсор у колонок. */}
        {steps !== undefined &&
          points.map((point, index) => {
            const step = steps[index];
            if (step === undefined) return null;
            const band = plotWidth / points.length;
            const before = index === 0 ? series.startBalance : points[index - 1]!.balance;

            return (
              <Tooltip key={`hover-${point.date}`}>
                <TooltipTrigger asChild>
                  <g className="group/step cursor-crosshair">
                    <rect
                      x={PADDING.left + band * index}
                      y={PADDING.top}
                      width={band}
                      height={plotHeight}
                      fill="transparent"
                      pointerEvents="all"
                    />
                    <line
                      x1={geometry[index]!.x}
                      x2={geometry[index]!.x}
                      y1={PADDING.top}
                      y2={PADDING.top + plotHeight}
                      stroke="var(--foreground)"
                      strokeOpacity={0.3}
                      strokeDasharray="3 3"
                      pointerEvents="none"
                      className="opacity-0 transition-opacity group-hover/step:opacity-100"
                    />
                    <circle
                      cx={geometry[index]!.x}
                      cy={geometry[index]!.y}
                      r={4.5}
                      fill="var(--chart-1)"
                      stroke="var(--chart-surface)"
                      strokeWidth={2}
                      pointerEvents="none"
                      className="opacity-0 transition-opacity group-hover/step:opacity-100"
                    />
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-80">
                  <StepTip
                    step={step}
                    balance={point.balance}
                    change={point.balance - before}
                    people={people}
                  />
                </TooltipContent>
              </Tooltip>
            );
          })}
      </svg>

      <figcaption className="text-muted-foreground mt-2 text-xs">
        Остаток на начало периода — {formatKopecks(series.startBalance)}, на конец —{' '}
        {formatKopecks(last.balance)}.{' '}
        {belowZero
          ? 'Тёплая полоса — область ниже нуля: там фонд в долгу.'
          : 'Ниже нуля фонд за этот период не уходил.'}
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
