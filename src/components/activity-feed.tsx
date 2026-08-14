import type { ReactNode } from 'react';

import { EVENT_COLOR, EVENT_LABEL, describeEvent } from '@/components/event-style';
import { Badge } from '@/components/ui/badge';
import type { IsoDate } from '@/lib/calc/types';
import {
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_STATUS_VARIANT,
  formatRelativeDate,
  type NamedUser,
} from '@/lib/format';
import type { TimelineEvent } from '@/lib/view/events';

/**
 * Лента последних событий (§6.1).
 *
 * Серверный компонент: событий немного, интерактивности нет, значит и в бандл
 * ехать нечему. Тип события несёт и цветную точку, и подпись — цвет здесь
 * не единственный носитель смысла (§12).
 */
export function ActivityFeed({
  events,
  people,
  today,
  emptyText = 'Событий пока не было.',
}: {
  events: readonly TimelineEvent[];
  people: ReadonlyMap<string, NamedUser>;
  today: IsoDate;
  emptyText?: string;
}): ReactNode {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col">
      {events.map((event) => {
        const { title, detail } = describeEvent(event, people);

        return (
          <li
            key={event.id}
            className="border-border flex items-start gap-3 border-b py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ background: EVENT_COLOR[event.kind] }}
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {EVENT_LABEL[event.kind]} · {formatRelativeDate(event.startsOn, today)}
                {detail === null ? '' : ` · ${detail}`}
              </p>
            </div>

            {event.status !== undefined && event.status !== 'CONFIRMED' && (
              <Badge variant={CONTRIBUTION_STATUS_VARIANT[event.status]} className="shrink-0">
                {CONTRIBUTION_STATUS_LABEL[event.status]}
              </Badge>
            )}
          </li>
        );
      })}
    </ol>
  );
}
