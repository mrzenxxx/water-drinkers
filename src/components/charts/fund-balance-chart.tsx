import type { ReactNode } from 'react';

import type { IsoDate } from '@/lib/calc/types';
import { formatDate, formatMonthShort } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import {
  bandCenter,
  linearScale,
  niceDomain,
  stepAreaPath,
  stepPath,
} from '@/lib/view/chart';
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
 * Один ряд — одна шкала. Второй оси у графика нет и не будет: совмещение
 * двух разномасштабных величин на одной картинке выдумывает связь, которой
 * в данных нет.
 */

const WIDTH = 760;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 76 };

export function FundBalanceChart({
  series,
  granularity,
}: {
  series: BalanceSeries;
  granularity: Granularity;
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
