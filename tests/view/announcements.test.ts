import { describe, expect, it } from 'vitest';

import {
  countUnread,
  isUnread,
  isVisible,
  parseAnnouncementBody,
  sortAnnouncements,
  summarize,
  type AnnouncementView,
} from '@/lib/view/announcements';

/**
 * Чистая логика раздела объявлений (§6.12): порядок, непрочитанное и разбор
 * текста. Ни базы, ни браузера — всё проверяется значениями.
 */

function announcement(overrides: Partial<AnnouncementView> & { id: string }): AnnouncementView {
  return {
    title: `Заголовок ${overrides.id}`,
    body: 'Текст объявления.',
    pinned: false,
    publishedAt: '2026-08-01T09:00:00.000Z',
    archivedAt: null,
    updatedAt: '2026-08-01T09:00:00.000Z',
    createdBy: 'u-admin',
    ...overrides,
  };
}

describe('видимость объявления', () => {
  it('участнику видно опубликованное и не убранное в архив', () => {
    expect(isVisible(announcement({ id: 'a' }))).toBe(true);
    expect(isVisible(announcement({ id: 'b', publishedAt: null }))).toBe(false);
    expect(
      isVisible(announcement({ id: 'c', archivedAt: '2026-08-02T09:00:00.000Z' })),
    ).toBe(false);
  });
});

describe('порядок списка', () => {
  it('закреплённые сверху, дальше свежие', () => {
    const items = [
      announcement({ id: 'old', publishedAt: '2026-07-01T09:00:00.000Z' }),
      announcement({ id: 'fresh', publishedAt: '2026-08-10T09:00:00.000Z' }),
      announcement({ id: 'guide', pinned: true, publishedAt: '2026-06-01T09:00:00.000Z' }),
    ];

    expect(sortAnnouncements(items).map((item) => item.id)).toEqual(['guide', 'fresh', 'old']);
  });

  it('порядок не зависит от порядка на входе и не «дрожит» на совпадающих датах', () => {
    const same = '2026-08-01T09:00:00.000Z';
    const items = [
      announcement({ id: 'b', publishedAt: same }),
      announcement({ id: 'a', publishedAt: same }),
    ];

    expect(sortAnnouncements(items).map((item) => item.id)).toEqual(['a', 'b']);
    expect(sortAnnouncements([...items].reverse()).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('черновик встаёт по времени правки: публикации у него ещё нет', () => {
    const items = [
      announcement({ id: 'published', publishedAt: '2026-08-01T09:00:00.000Z' }),
      announcement({
        id: 'draft',
        publishedAt: null,
        updatedAt: '2026-08-05T09:00:00.000Z',
      }),
    ];

    expect(sortAnnouncements(items).map((item) => item.id)).toEqual(['draft', 'published']);
  });

  it('исходный массив не меняется', () => {
    const items = [announcement({ id: 'b' }), announcement({ id: 'a', pinned: true })];
    sortAnnouncements(items);
    expect(items.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('непрочитанное', () => {
  const items = [
    announcement({ id: 'old', publishedAt: '2026-07-01T09:00:00.000Z' }),
    announcement({ id: 'fresh', publishedAt: '2026-08-10T09:00:00.000Z' }),
    announcement({ id: 'draft', publishedAt: null }),
    announcement({
      id: 'archived',
      publishedAt: '2026-08-11T09:00:00.000Z',
      archivedAt: '2026-08-12T09:00:00.000Z',
    }),
  ];

  it('ни разу не заходившему ново всё опубликованное', () => {
    expect(countUnread(items, null)).toBe(2);
  });

  it('отсчёт идёт от последнего захода', () => {
    expect(countUnread(items, '2026-08-01T00:00:00.000Z')).toBe(1);
    expect(countUnread(items, '2026-08-10T09:00:00.000Z')).toBe(0);
  });

  it('черновик и архив новыми не бывают: участник их не видит', () => {
    expect(isUnread(items[2] as AnnouncementView, null)).toBe(false);
    expect(isUnread(items[3] as AnnouncementView, null)).toBe(false);
  });

  it('правка не делает объявление новым заново', () => {
    // Иначе исправленная опечатка в инструкции подсветилась бы всей команде
    // как свежая новость.
    const edited = announcement({
      id: 'guide',
      publishedAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-08-20T09:00:00.000Z',
    });

    expect(isUnread(edited, '2026-07-02T09:00:00.000Z')).toBe(false);
  });
});

describe('разбор текста', () => {
  it('пустая строка начинает новый абзац, перенос внутри абзаца — нет', () => {
    expect(parseAnnouncementBody('Первая строка\nвторая строка\n\nВторой абзац')).toEqual([
      { kind: 'paragraph', text: 'Первая строка вторая строка' },
      { kind: 'paragraph', text: 'Второй абзац' },
    ]);
  });

  it('маркеры дают список, цифры — шаги', () => {
    expect(parseAnnouncementBody('- один\n* два\n• три')).toEqual([
      { kind: 'bullets', items: ['один', 'два', 'три'] },
    ]);

    expect(parseAnnouncementBody('1. первый\n2) второй')).toEqual([
      { kind: 'steps', items: ['первый', 'второй'] },
    ]);
  });

  it('список и абзац разделяются даже без пустой строки между ними', () => {
    expect(parseAnnouncementBody('Как внести взнос:\n1. Приложите чек\n2. Отправьте\nГотово')).toEqual([
      { kind: 'paragraph', text: 'Как внести взнос:' },
      { kind: 'steps', items: ['Приложите чек', 'Отправьте'] },
      { kind: 'paragraph', text: 'Готово' },
    ]);
  });

  it('смена вида маркера начинает новый блок', () => {
    expect(parseAnnouncementBody('- пункт\n1. шаг')).toEqual([
      { kind: 'bullets', items: ['пункт'] },
      { kind: 'steps', items: ['шаг'] },
    ]);
  });

  it('пустой текст даёт пустой список блоков, а не пустой абзац', () => {
    expect(parseAnnouncementBody('')).toEqual([]);
    expect(parseAnnouncementBody('\n\n   \n')).toEqual([]);
  });
});

describe('короткая выжимка', () => {
  it('короткий текст остаётся как есть, только без лишних пробелов', () => {
    expect(summarize('Вода приедет\n\nв четверг')).toBe('Вода приедет в четверг');
  });

  it('длинный обрезается по границе слова', () => {
    const short = summarize('а'.repeat(10) + ' ' + 'б'.repeat(200), 40);
    expect(short.endsWith('…')).toBe(true);
    expect(short.length).toBeLessThanOrEqual(41);
  });
});
