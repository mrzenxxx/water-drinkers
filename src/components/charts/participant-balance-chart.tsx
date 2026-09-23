'use client';

import { useState, type ReactNode } from 'react';

import {
  PlotTip,
  StickyAxis,
  useFrameWidth,
  usePlotHover,
  useScrollToEnd,
} from '@/components/charts/plot-frame';
import type { IsoDate } from '@/lib/calc/types';
import { formatDate, formatMonthShort } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  bandLayout,
  labelStride,
  linearScale,
  niceDomain,
  stepPath,
} from '@/lib/view/chart';
import type { Granularity } from '@/lib/view/filters';
import type { ParticipantSeries } from '@/lib/view/series';

/**
 * Балансы выбранных участников во времени (§6.9).
 *
 * Все линии на **одной** шкале: это одна и та же величина — баланс в
 * копейках, — поэтому наложение здесь честное, в отличие от совмещения
 * остатка фонда с чьим-то балансом. Линии ступенчатые по той же причине,
 * что и у фонда: баланс меняется скачком на взносе и на заказе.
 *
 * Цвет у участника — по его месту в выборе, а не навсегда: слотов палитры
 * пять, участников больше. С шестого цвета повторяются, но линия становится
 * пунктирной, так что две линии одного цвета не спутать. Цвет никогда не
 * работает в одиночку — рядом имя в легенде и в подсказке (§12).
 *
 * Наведение или касание выбирает шаг; линия, ближайшая к курсору или пальцу,
 * раскрывается в подсказке целиком — отдел, баланс, изменение за шаг и из
 * чего оно сложилось. Нажатие на имя в легенде выделяет участника: остальные
 * линии бледнеют, подсказка раскрывает его.
 */

/** Участник для подписи линии. */
export type ParticipantLine = {
  userId: string;
  name: string;
  department: string | null;
  isMe: boolean;
};

const FALLBACK_WIDTH = 760;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 64 };
const MIN_BAND = 4;
const LABEL_WIDTH = 52;
/** Ближе стольких пикселей по вертикали линия считается «под курсором». */
const NEAR_PX = 28;

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const DASHES = [undefined, '6 3', '2 3'];

function lineStyle(index: number): { color: string; dash: string | undefined } {
  return {
    color: PALETTE[index % PALETTE.length]!,
    dash: DASHES[Math.floor(index / PALETTE.length) % DASHES.length],
  };
}

export function ParticipantBalanceChart({
  series,
  lines,
  granularity,
  titles,
}: {
  series: readonly ParticipantSeries[];
  lines: readonly ParticipantLine[];
  granularity: Granularity;
  /** Название каждого шага — параллельно точкам. */
  titles: readonly string[];
}): ReactNode {
  const count = series[0]?.points.length ?? 0;
  const { ref, frame, width: frameWidth } = useFrameWidth(FALLBACK_WIDTH);
  const layout = bandLayout(count, frameWidth - PADDING.left - PADDING.right, MIN_BAND);
  const width = PADDING.left + layout.plotWidth + PADDING.right;
  const { scrollRef, scrollLeft, onScroll } = useScrollToEnd(width, layout.scrolls);
  const hover = usePlotHover({ count, left: PADDING.left, band: layout.band, container: frame });
  const [focused, setFocused] = useState<string | null>(null);

  if (series.length === 0 || count === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Выберите участников в фильтре — здесь лягут их балансы, наложенные на одну шкалу.
      </p>
    );
  }

  const byId = new Map(lines.map((line) => [line.userId, line]));
  const styles = new Map(series.map((line, index) => [line.userId, lineStyle(index)]));

  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const { domain, ticks } = niceDomain(
    series.flatMap((line) => [line.startBalance, ...line.points.map((point) => point.balance)]),
    4,
  );
  const y = linearScale(domain, [PADDING.top + plotHeight, PADDING.top]);
  const centerX = (index: number): number => PADDING.left + layout.band * (index + 0.5);
  const anyOwes = domain[0] < 0;

  const labelEvery = labelStride(count, layout.band, LABEL_WIDTH);
  const dateKey = series[0]!.points.map((point) => point.date);
  const formatKey = (key: IsoDate): string =>
    granularity === 'month' ? formatMonthShort(key.slice(0, 7)) : formatDate(key).slice(0, 5);

  const active = hover.active;

  // Линия под курсором: ближайшая по вертикали в выбранном шаге.
  let near: string | null = null;
  if (active !== null && hover.pointerY !== null) {
    let best = NEAR_PX;
    for (const line of series) {
      const distance = Math.abs(y(line.points[active]!.balance) - hover.pointerY);
      if (distance < best) {
        best = distance;
        near = line.userId;
      }
    }
  }
  const emphasized = focused ?? near ?? (series.length === 1 ? series[0]!.userId : null);

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
            aria-label={`Балансы участников за период: ${series
              .map((line) => {
                const last = line.points[line.points.length - 1]!;
                return `${byId.get(line.userId)?.name ?? line.userId} — ${formatKopecks(last.balance)}`;
              })
              .join('; ')}. Стрелки влево и вправо переходят по шагам.`}
            className="focus-visible:ring-ring/50 block touch-manipulation rounded-sm outline-none select-none focus-visible:ring-2"
            {...hover.svgProps}
          >
            {anyOwes && (
              <rect
                x={PADDING.left}
                y={y(0)}
                width={layout.plotWidth}
                height={Math.max(0, PADDING.top + plotHeight - y(0))}
                fill="var(--owes)"
                fillOpacity={0.06}
              />
            )}

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + layout.plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? 'var(--muted-foreground)' : 'var(--chart-grid)'}
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

            {active !== null && (
              <line
                x1={centerX(active)}
                x2={centerX(active)}
                y1={PADDING.top}
                y2={PADDING.top + plotHeight}
                stroke="var(--foreground)"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
            )}

            {/* Выделенная линия рисуется последней, чтобы лежать поверх остальных. */}
            {[...series]
              .sort((a, b) => Number(a.userId === emphasized) - Number(b.userId === emphasized))
              .map((line) => {
                const style = styles.get(line.userId)!;
                const geometry = line.points.map((point, index) => ({
                  x: centerX(index),
                  y: y(point.balance),
                }));
                // Ступень держит значение шага на всю ширину его полосы.
                const stepGeometry = line.points.map((point, index) => ({
                  x: PADDING.left + layout.band * index,
                  y: y(point.balance),
                }));
                const dimmed = emphasized !== null && emphasized !== line.userId;
                const last = {
                  x: PADDING.left + layout.plotWidth,
                  y: y(line.points[line.points.length - 1]!.balance),
                };

                return (
                  <g
                    key={line.userId}
                    className="transition-opacity duration-150 motion-reduce:transition-none"
                    opacity={dimmed ? 0.25 : 1}
                    pointerEvents="none"
                  >
                    <path
                      d={stepPath(stepGeometry, PADDING.left + layout.plotWidth)}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={emphasized === line.userId ? 3 : 2}
                      strokeDasharray={style.dash}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={last.x}
                      cy={last.y}
                      r={3.5}
                      fill={style.color}
                      stroke="var(--chart-surface)"
                      strokeWidth={2}
                    />
                    {active !== null && (
                      <circle
                        cx={geometry[active]!.x}
                        cy={geometry[active]!.y}
                        r={emphasized === line.userId ? 5 : 3.5}
                        fill={style.color}
                        stroke="var(--chart-surface)"
                        strokeWidth={2}
                      />
                    )}
                  </g>
                );
              })}

            {dateKey.map((date, index) =>
              index % labelEvery === 0 ? (
                <text
                  key={date}
                  x={centerX(index)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatKey(date)}
                </text>
              ) : null,
            )}

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

        {layout.scrolls && (
          <StickyAxis
            width={PADDING.left}
            height={HEIGHT - PADDING.bottom}
            ticks={ticks.map((tick) => ({
              y: y(tick),
              label: formatKopecks(tick, { withSymbol: false }),
            }))}
          />
        )}

        {active !== null && (
          <PlotTip x={centerX(active) - scrollLeft} frameWidth={frameWidth}>
            <ParticipantsTip
              title={titles[active] ?? formatKey(dateKey[active]!)}
              series={series}
              index={active}
              byId={byId}
              styles={styles}
              emphasized={emphasized}
            />
          </PlotTip>
        )}
      </div>

      <figcaption className="mt-3 flex flex-col gap-2 text-xs">
        <ul className="flex flex-wrap gap-1.5" aria-label="Участники на графике">
          {series.map((line) => {
            const person = byId.get(line.userId);
            const style = styles.get(line.userId)!;
            const last = line.points[line.points.length - 1]!;
            const pressed = focused === line.userId;

            return (
              <li key={line.userId}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setFocused(pressed ? null : line.userId)}
                  className={cn(
                    'border-border hover:bg-foreground/5 flex items-center gap-2 rounded-md border px-2 py-1 transition-colors',
                    pressed && 'bg-foreground/10 border-foreground/30',
                    focused !== null && !pressed && 'opacity-60',
                  )}
                >
                  <LineSwatch color={style.color} dash={style.dash} />
                  <span>
                    {person?.name ?? line.userId}
                    {person?.isMe === true && <span className="text-muted-foreground"> (вы)</span>}
                  </span>
                  <span
                    className={cn(
                      'tabular font-medium',
                      last.balance < 0 ? 'text-owes' : 'text-foreground',
                    )}
                  >
                    {formatKopecks(last.balance, { alwaysSign: true })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground">
          Баланс на конец каждого шага — ровно тот, что приложение показало бы в тот день.
          Нажмите на имя, чтобы выделить линию.
          {anyOwes && ' Тёплая полоса — область ниже нуля: там участник должен в кассу.'}
          {layout.scrolls && ' График не поместился целиком — листается вбок.'}
        </p>
      </figcaption>
    </figure>
  );
}

/** Образец линии для легенды и подсказки: тот же цвет и тот же пунктир. */
function LineSwatch({ color, dash }: { color: string; dash: string | undefined }): ReactNode {
  return (
    <svg aria-hidden width={16} height={6} className="shrink-0">
      <line
        x1={1}
        x2={15}
        y1={3}
        y2={3}
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Подсказка шага: у всех участников — баланс, у выделенного — ещё отдел,
 * изменение за шаг и из чего оно сложилось.
 */
function ParticipantsTip({
  title,
  series,
  index,
  byId,
  styles,
  emphasized,
}: {
  title: string;
  series: readonly ParticipantSeries[];
  index: number;
  byId: ReadonlyMap<string, ParticipantLine>;
  styles: ReadonlyMap<string, { color: string; dash: string | undefined }>;
  emphasized: string | null;
}): ReactNode {
  const rows = series
    .map((line) => {
      const point = line.points[index]!;
      const before = index === 0 ? line.startBalance : line.points[index - 1]!.balance;
      return { line, point, change: point.balance - before };
    })
    // Выделенный — первым, остальные по убыванию баланса: должники внизу.
    .sort(
      (a, b) =>
        Number(b.line.userId === emphasized) - Number(a.line.userId === emphasized) ||
        b.point.balance - a.point.balance,
    );

  return (
    <div className="flex min-w-56 flex-col gap-1.5">
      <p className="font-semibold">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map(({ line, point, change }) => {
          const person = byId.get(line.userId);
          const style = styles.get(line.userId)!;
          const open = line.userId === emphasized;

          return (
            <li
              key={line.userId}
              className={cn(open && 'border-border -mx-1 rounded-md border px-1 py-1')}
            >
              <div className="flex items-center gap-2">
                <LineSwatch color={style.color} dash={style.dash} />
                <span className={cn('min-w-0 flex-1 truncate', open && 'font-medium')}>
                  {person?.name ?? line.userId}
                  {person?.isMe === true && <span className="text-muted-foreground"> (вы)</span>}
                </span>
                <span
                  className={cn(
                    'tabular text-right',
                    point.balance < 0 && 'text-owes',
                    open && 'font-medium',
                  )}
                >
                  {formatKopecks(point.balance, { alwaysSign: true })}
                </span>
              </div>
              {open && (
                <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 pl-6">
                  {person?.department != null && (
                    <>
                      <dt>Отдел</dt>
                      <dd className="text-foreground text-right">{person.department}</dd>
                    </>
                  )}
                  <dt>Изменение</dt>
                  <dd className="tabular text-foreground text-right">
                    {change === 0 ? 'без движения' : formatKopecks(change, { alwaysSign: true })}
                  </dd>
                  {point.contributed !== 0 && (
                    <>
                      <dt>Внёс</dt>
                      <dd className="tabular text-foreground text-right">
                        {formatKopecks(point.contributed, { alwaysSign: true })}
                      </dd>
                    </>
                  )}
                  {point.spent !== 0 && (
                    <>
                      <dt>Доля в заказах</dt>
                      <dd className="tabular text-foreground text-right">
                        {formatKopecks(-point.spent, { alwaysSign: true })}
                      </dd>
                    </>
                  )}
                  <dt>Состояние</dt>
                  <dd className={cn('text-right', point.balance < 0 ? 'text-owes' : 'text-foreground')}>
                    {point.balance < 0 ? 'должен в кассу' : point.balance === 0 ? 'в нуле' : 'в плюсе'}
                  </dd>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
      {emphasized === null && series.length > 1 && (
        <p className="text-muted-foreground">Наведите на линию или коснитесь её, чтобы раскрыть участника</p>
      )}
    </div>
  );
}
