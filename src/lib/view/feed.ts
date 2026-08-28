/**
 * Лента главной (§6.1): события фонда и объявления одним потоком.
 *
 * Объявление по-прежнему **не событие фонда**: суммы у него нет, в расчёт
 * балансов оно не входит, в `EVENT_KINDS` не добавлено и на таймлайне
 * дашборда (§6.9) не появляется — там пять типов намертво связаны со слотами
 * палитры графиков. Но на главной человек читает одну хронику того, что
 * произошло в кассе, и «сменили поставщика» — часть этой хроники наравне
 * с заказом воды. Поэтому объявления сводятся с событиями здесь, на уровне
 * экрана, а не в модели: у элемента ленты свой тип, а не шестой вид события.
 *
 * Чистые функции: ни базы, ни часов. «Сейчас» и «когда участник заходил
 * в раздел» приходят аргументами — иначе ни порядок, ни пометку «Новое»
 * нельзя проверить тестом.
 */

import { compareDates } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import { isUnread, isVisible, type AnnouncementView } from '@/lib/view/announcements';
import type { TimelineEvent } from '@/lib/view/events';

/** Элемент ленты: событие фонда или объявление администратора. */
export type FeedItem =
  | { key: string; date: IsoDate; kind: 'event'; event: TimelineEvent }
  | {
      key: string;
      date: IsoDate;
      kind: 'announcement';
      announcement: AnnouncementView;
      /** Участник ещё не заходил в раздел после публикации (§6.12). */
      unread: boolean;
    };

/** События как есть, в том же порядке: лента дашборда объявлений не показывает. */
export function toFeedItems(events: readonly TimelineEvent[]): FeedItem[] {
  return events.map((event) => ({
    key: event.id,
    date: event.startsOn,
    kind: 'event',
    event,
  }));
}

/** Дата публикации: у объявления момент времени, ленте хватает дня. */
function publishedOn(item: AnnouncementView): IsoDate {
  return (item.publishedAt ?? item.updatedAt).slice(0, 10);
}

/**
 * Сведённая лента: свежее сверху.
 *
 * В один день объявление встаёт выше событий: администратор пишет о том,
 * что происходит с кассой, и читать это осмысленно до, а не после списка
 * заказов того же дня. Последний ключ сортировки — идентификатор: без него
 * два элемента одной даты менялись бы местами между отрисовками, и лента
 * «дрожала» бы на каждом обновлении.
 */
export function buildFeed({
  events,
  announcements,
  seenAt,
  limit,
}: {
  events: readonly TimelineEvent[];
  announcements: readonly AnnouncementView[];
  /** Момент последнего захода в раздел объявлений; `null` — не заходил. */
  seenAt: string | null;
  /** Сколько элементов оставить. Не задан — все. */
  limit?: number;
}): FeedItem[] {
  const items: FeedItem[] = toFeedItems(events);

  for (const announcement of announcements) {
    // Черновик и архив участнику не видны — на главной тем более.
    if (!isVisible(announcement)) continue;

    items.push({
      key: `announcement:${announcement.id}`,
      date: publishedOn(announcement),
      kind: 'announcement',
      announcement,
      unread: isUnread(announcement, seenAt),
    });
  }

  items.sort(compareNewestFirst);
  return limit === undefined ? items : items.slice(0, limit);
}

function compareNewestFirst(a: FeedItem, b: FeedItem): number {
  const byDate = compareDates(b.date, a.date);
  if (byDate !== 0) return byDate;

  if (a.kind !== b.kind) return a.kind === 'announcement' ? -1 : 1;

  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}
