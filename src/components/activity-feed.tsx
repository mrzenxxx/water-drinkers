import type { ReactNode } from 'react';

import { EVENT_COLOR, EVENT_LABEL, describeEvent } from '@/components/event-style';
import { FeedAnnouncement } from '@/components/feed-announcement';
import { ReceiptPreview } from '@/components/receipt-preview';
import { CONTRIBUTION_STATUS_ICON } from '@/components/status-icons';
import { Badge } from '@/components/ui/badge';
import type { ContributionStatus, IsoDate } from '@/lib/calc/types';
import {
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_STATUS_VARIANT,
  formatDate,
  formatRelativeDate,
  type NamedUser,
} from '@/lib/format';
import type { FeedItem } from '@/lib/view/feed';

/**
 * Лента событий (§6.1).
 *
 * Серверный компонент: событий немного, интерактивности нет, значит и в бандл
 * ехать нечему. Раскрытие объявления держит `<details>` — состояние живёт
 * в разметке, а не в React.
 *
 * На вход идут элементы ленты, а не события: на главной в тот же поток
 * попадают объявления администратора (§6.12), а в статистике — нет. Что
 * сводить и в каком порядке, решает `buildFeed`, чистая функция; компонент
 * только рисует и порядок не меняет.
 *
 * Тип события несёт и цветную точку, и подпись — цвет здесь не единственный
 * носитель смысла (§12).
 *
 * Бейджики справа от события говорят то же, что говорит таблица взносов, и
 * теми же значками (`status-icons.ts`): у статуса своя форма, поэтому цвет
 * бейджика ничего не несёт в одиночку. Значок стоит перед словом и отделён
 * от него отступом — это тот же жест, которым помечена строка таблицы, а не
 * второе обозначение того же.
 *
 * У заказа бейджик «Чек»: деньги ушли из общего фонда, и по каждой трате
 * должен быть документ (§6.5). Бейджик открывает тот же предпросмотр, что и
 * раздел «Заказы», — открыть чек может любой участник, деньги общие (§8.4).
 * От соседних бейджиков он отличается цветом и откликом на наведение: те
 * только называют состояние, а этот ещё и нажимается.
 */
/** Статус взноса бейджиком: тот же значок, что в таблице, и то же слово. */
function StatusBadge({ status }: { status: ContributionStatus }): ReactNode {
  const Icon = CONTRIBUTION_STATUS_ICON[status];

  return (
    <Badge variant={CONTRIBUTION_STATUS_VARIANT[status]} className="shrink-0 gap-1.5">
      <Icon aria-hidden />
      {CONTRIBUTION_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ActivityFeed({
  items,
  people,
  today,
  emptyText = 'Событий пока не было.',
}: {
  items: readonly FeedItem[];
  people: ReadonlyMap<string, NamedUser>;
  today: IsoDate;
  emptyText?: string;
}): ReactNode {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col">
      {items.map((item) => {
        if (item.kind === 'announcement') {
          return (
            // Разделительной черты у объявления нет: его отделяет собственная
            // стеклянная плитка, и линия поверх неё была бы вторым забором.
            <li key={item.key} className="py-2">
              <FeedAnnouncement
                item={item.announcement}
                date={item.date}
                today={today}
                unread={item.unread}
              />
            </li>
          );
        }

        const event = item.event;
        const { title, detail } = describeEvent(event, people);

        return (
          <li
            key={item.key}
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
              <StatusBadge status={event.status} />
            )}

            {event.receipt != null && (
              <ReceiptPreview
                variant="badge"
                label="Чек"
                src={`/api/receipts/${event.receipt.id}`}
                mediaType={event.receipt.mediaType}
                title={`Чек заказа от ${formatDate(event.startsOn)}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
