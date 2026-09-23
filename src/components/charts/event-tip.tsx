import type { ReactNode } from 'react';

import { EVENT_COLOR, type EventDetails } from '@/components/event-style';

/**
 * Содержимое подсказки о событии: тип с цветом слота, дата и поля карточки.
 *
 * Серверный компонент — подсказке нечего делать на клиенте, кроме как
 * показаться: разметку для неё готовит сервер, а всплывает её `Tooltip`.
 */
export function EventTip({ details }: { details: EventDetails }): ReactNode {
  return (
    <div className="flex min-w-44 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ background: EVENT_COLOR[details.kind] }}
        />
        <span className="font-semibold">{details.label}</span>
        <span className="text-muted-foreground tabular ml-auto pl-2">{details.when}</span>
      </div>
      {details.rows.length > 0 && <EventTipRows rows={details.rows} />}
    </div>
  );
}

export function EventTipRows({ rows }: { rows: EventDetails['rows'] }): ReactNode {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="tabular min-w-0 text-right break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
