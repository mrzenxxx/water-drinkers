import type { ReactNode } from 'react';

import { EventTip } from '@/components/charts/event-tip';
import {
  EVENT_COLOR,
  EVENT_LABEL_PLURAL,
  describeEvent,
  eventDetails,
} from '@/components/event-style';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { IsoDate } from '@/lib/calc/types';
import { formatDate, formatDateRange, type NamedUser } from '@/lib/format';
import { buildLanes, type LaneWindow } from '@/lib/view/timeline';
import type { EventKind, TimelineEvent } from '@/lib/view/events';

/**
 * Таймлайн событий (§6.9).
 *
 * Дорожка на каждый тип события; отсутствия рисуются **полосами**, а не
 * точками — у них есть длительность. Раскладка по строкам внутри дорожки
 * вынесена в чистую функцию `packRows` и покрыта тестами.
 *
 * Сделано разметкой, а не SVG: подписи в HTML переносятся и масштабируются
 * сами, а полоса, у которой есть текст, в SVG требовала бы ручного измерения.
 * Дорожки серверные; при наведении на отметку всплывает карточка события —
 * кто внёс, кто отсутствовал, кто оформил заказ. Те же данные продублированы
 * списком под лентой, поэтому значение никогда не спрятано в подсказку.
 */
export function TimelineLanes({
  events,
  kinds,
  window,
  people,
}: {
  events: readonly TimelineEvent[];
  kinds: readonly EventKind[];
  window: LaneWindow;
  people: ReadonlyMap<string, NamedUser>;
}): ReactNode {
  const lanes = buildLanes(events, kinds, window).filter((lane) => lane.items.length > 0);

  if (lanes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        За выбранный период событий нет. Расширьте период или включите больше типов.
      </p>
    );
  }

  return (
    <div className="plot-surface flex flex-col gap-3 p-3">
      {lanes.map((lane) => (
        <div key={lane.kind} className="sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
          <div className="text-muted-foreground flex items-center gap-2 pb-1 text-xs sm:pb-0">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ background: EVENT_COLOR[lane.kind] }}
            />
            {EVENT_LABEL_PLURAL[lane.kind]}
            <span className="tabular">({lane.items.length})</span>
          </div>

          <div
            className="bg-muted/40 relative w-full rounded-md"
            style={{ height: `${Math.max(1, lane.rows) * 18 + 8}px` }}
          >
            {lane.items.map((item) => {
              const { title, detail } = describeEvent(item.event, people);
              const isBar = item.event.kind === 'ABSENCE';

              return (
                <Tooltip key={item.event.id}>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute cursor-default rounded-full transition-[filter,box-shadow] hover:brightness-125 hover:ring-2 hover:ring-foreground/40"
                      style={{
                        left: `${item.start * 100}%`,
                        width: `${item.length * 100}%`,
                        top: `${item.row * 18 + 4}px`,
                        height: '10px',
                        background: EVENT_COLOR[item.event.kind],
                        // Полоса отсутствия чуть прозрачнее: она длинная и не должна
                        // забивать собой точечные события соседних дорожек.
                        opacity: isBar ? 0.75 : 1,
                      }}
                    >
                      <span className="sr-only">
                        {title}
                        {detail === null ? '' : ` · ${detail}`}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-72">
                    <EventTip details={eventDetails(item.event, people)} />
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      <TimelineAxis from={window.from} to={window.to} />
    </div>
  );
}

/** Подпись периода под дорожками: обе границы и середина. */
function TimelineAxis({ from, to }: { from: IsoDate; to: IsoDate }): ReactNode {
  return (
    <div className="text-muted-foreground sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <div className="hidden sm:block" />
      <div className="border-chart-grid flex justify-between border-t pt-1 text-[11px]">
        <span className="tabular">{formatDate(from)}</span>
        <span className="sr-only">{formatDateRange(from, to)}</span>
        <span className="tabular">{formatDate(to)}</span>
      </div>
    </div>
  );
}
