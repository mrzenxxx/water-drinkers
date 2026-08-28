import { describe, expect, it } from 'vitest';

import type { AnnouncementView } from '@/lib/view/announcements';
import type { TimelineEvent } from '@/lib/view/events';
import { buildFeed, toFeedItems } from '@/lib/view/feed';

/**
 * Лента главной (§6.1): события фонда и объявления администратора (§6.12)
 * одним потоком. Функция чистая — ни базы, ни браузера, ни часов: «сейчас»
 * и момент последнего захода в раздел приходят аргументами.
 */

function event(overrides: Partial<TimelineEvent> & { id: string }): TimelineEvent {
  return {
    kind: 'ORDER',
    startsOn: '2026-08-10',
    endsOn: '2026-08-10',
    amount: -100_00,
    userId: null,
    ...overrides,
  };
}

function announcement(
  overrides: Partial<AnnouncementView> & { id: string },
): AnnouncementView {
  return {
    title: `Заголовок ${overrides.id}`,
    body: 'Текст объявления.',
    pinned: false,
    publishedAt: '2026-08-11T09:00:00.000Z',
    archivedAt: null,
    updatedAt: '2026-08-11T09:00:00.000Z',
    createdBy: 'u-admin',
    image: null,
    ...overrides,
  };
}

describe('сведение ленты', () => {
  it('свежее сверху, объявления вперемешку с событиями', () => {
    const items = buildFeed({
      events: [
        event({ id: 'order:old', startsOn: '2026-08-01', endsOn: '2026-08-01' }),
        event({ id: 'order:new', startsOn: '2026-08-20', endsOn: '2026-08-20' }),
      ],
      announcements: [announcement({ id: 'mid', publishedAt: '2026-08-10T09:00:00.000Z' })],
      seenAt: null,
    });

    expect(items.map((item) => item.key)).toEqual([
      'order:new',
      'announcement:mid',
      'order:old',
    ]);
  });

  it('в один день объявление стоит выше событий', () => {
    const items = buildFeed({
      events: [event({ id: 'order:same', startsOn: '2026-08-11', endsOn: '2026-08-11' })],
      announcements: [announcement({ id: 'same' })],
      seenAt: null,
    });

    expect(items.map((item) => item.kind)).toEqual(['announcement', 'event']);
  });

  it('порядок не «дрожит» на совпадающих датах', () => {
    const same = { startsOn: '2026-08-11', endsOn: '2026-08-11' } as const;
    const forward = buildFeed({
      events: [event({ id: 'order:a', ...same }), event({ id: 'order:b', ...same })],
      announcements: [],
      seenAt: null,
    });
    const backward = buildFeed({
      events: [event({ id: 'order:b', ...same }), event({ id: 'order:a', ...same })],
      announcements: [],
      seenAt: null,
    });

    expect(forward.map((item) => item.key)).toEqual(backward.map((item) => item.key));
  });

  it('черновик и архив в ленту не попадают', () => {
    const items = buildFeed({
      events: [],
      announcements: [
        announcement({ id: 'draft', publishedAt: null }),
        announcement({ id: 'archived', archivedAt: '2026-08-12T09:00:00.000Z' }),
        announcement({ id: 'live' }),
      ],
      seenAt: null,
    });

    expect(items.map((item) => item.key)).toEqual(['announcement:live']);
  });

  it('непрочитанное помечено, прочитанное — нет', () => {
    const items = buildFeed({
      events: [],
      announcements: [
        announcement({ id: 'old', publishedAt: '2026-08-01T09:00:00.000Z' }),
        announcement({ id: 'fresh', publishedAt: '2026-08-20T09:00:00.000Z' }),
      ],
      seenAt: '2026-08-10T00:00:00.000Z',
    });

    expect(
      items.map((item) => (item.kind === 'announcement' ? [item.key, item.unread] : null)),
    ).toEqual([
      ['announcement:fresh', true],
      ['announcement:old', false],
    ]);
  });

  it('предел режет уже сведённый список, а не одни события', () => {
    const items = buildFeed({
      events: [
        event({ id: 'order:1', startsOn: '2026-08-01', endsOn: '2026-08-01' }),
        event({ id: 'order:2', startsOn: '2026-08-02', endsOn: '2026-08-02' }),
      ],
      announcements: [announcement({ id: 'top', publishedAt: '2026-08-20T09:00:00.000Z' })],
      seenAt: null,
      limit: 2,
    });

    expect(items.map((item) => item.key)).toEqual(['announcement:top', 'order:2']);
  });
});

describe('лента дашборда', () => {
  it('события идут как есть: порядок задаёт группировка, а не лента', () => {
    const events = [
      event({ id: 'order:b', startsOn: '2026-08-02', endsOn: '2026-08-02' }),
      event({ id: 'order:a', startsOn: '2026-08-01', endsOn: '2026-08-01' }),
    ];

    expect(toFeedItems(events).map((item) => item.key)).toEqual(['order:b', 'order:a']);
  });
});
