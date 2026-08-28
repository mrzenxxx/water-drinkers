/**
 * Объявления администратора (§6.12): порядок, непрочитанное и разбор текста.
 *
 * Здесь только чистые функции — ни базы, ни `next/*`, ни часов. «Сейчас»
 * и «когда участник заходил» приходят аргументами: иначе ни порядок списка,
 * ни счётчик непрочитанного нельзя проверить тестом.
 *
 * Объявление **не событие фонда**. Оно не несёт суммы, не участвует в расчёте
 * балансов и не попадает на таймлайн §6.9: `EVENT_KINDS` намертво связан со
 * слотами палитры графиков, и шестой тип потребовал бы шестого цвета там, где
 * пять уже на пределе различимости. Поэтому — свой тип и свой список.
 *
 * В ленту главной объявление всё же попадает, но сводится с событиями на
 * уровне экрана — см. `src/lib/view/feed.ts`. Модель при этом не меняется.
 */

/**
 * Картинка объявления в том виде, в каком её показывает экран.
 *
 * Байтов здесь нет: они лежат отдельной таблицей и отдаются одним обработчиком
 * по ссылке. Размеры нужны разметке — зная их, страница резервирует место
 * и не дёргается, когда картинка догрузится.
 */
export type AnnouncementImageView = {
  url: string;
  alt: string;
  mediaType: string;
  width: number;
  height: number;
};

/**
 * Адрес выдачи картинки.
 *
 * Ссылка ведёт на приложение, а не на хранилище: байты сегодня в базе, завтра
 * могут переехать, и это не должно означать правку схемы и клиента. Ровно тем
 * же соображением живёт `Receipt.url` (§8).
 */
export function announcementImageUrl(announcementId: string): string {
  return `/api/notices/${announcementId}/image`;
}

/**
 * Описание картинки из колонок объявления или `null`, если её нет.
 *
 * Четыре колонки заполнены вместе или пусты вместе — это гарантирует CHECK
 * в §11. Здесь проверяется то же самое: строка, пришедшая из базы прошлой
 * версии, не должна давать картинку без подписи.
 */
export function toImageView(row: {
  id: string;
  imageMediaType: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}): AnnouncementImageView | null {
  if (
    row.imageMediaType === null ||
    row.imageAlt === null ||
    row.imageWidth === null ||
    row.imageHeight === null
  ) {
    return null;
  }

  return {
    url: announcementImageUrl(row.id),
    alt: row.imageAlt,
    mediaType: row.imageMediaType,
    width: row.imageWidth,
    height: row.imageHeight,
  };
}

/** Объявление в том виде, в каком его показывает экран. */
export type AnnouncementView = {
  id: string;
  title: string;
  body: string;
  /** Закреплённое не тонет: так живут инструкции по пользованию. */
  pinned: boolean;
  /** Момент публикации ISO 8601; `null` — черновик, участнику не виден. */
  publishedAt: string | null;
  /** Момент снятия с глаз; `null` — объявление в списке. */
  archivedAt: string | null;
  updatedAt: string;
  createdBy: string;
  /** Приложенная картинка; `null` — её нет. */
  image: AnnouncementImageView | null;
};

/** Видно ли объявление участнику: опубликовано и не убрано в архив. */
export function isVisible(item: AnnouncementView): boolean {
  return item.publishedAt !== null && item.archivedAt === null;
}

/**
 * Порядок списка: закреплённые сверху, дальше свежие.
 *
 * Черновик сортируется по `updatedAt` — публикации у него ещё нет, а в списке
 * администратора он обязан стоять на осмысленном месте, а не в хвосте.
 * Последний ключ — идентификатор: без него два объявления одной минуты
 * менялись бы местами между отрисовками, и список «дрожал» бы.
 */
export function sortAnnouncements(items: readonly AnnouncementView[]): AnnouncementView[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const byDate = orderKey(b).localeCompare(orderKey(a));
    if (byDate !== 0) return byDate;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function orderKey(item: AnnouncementView): string {
  return item.publishedAt ?? item.updatedAt;
}

/**
 * Новое ли объявление для участника.
 *
 * Отсчёт — от момента последнего захода в раздел (`seenAt`). Ни разу не
 * заходил — новым считается всё опубликованное: человеку, который открыл
 * раздел впервые, действительно ново каждое сообщение.
 *
 * Правка объявления новым его не делает: иначе исправленная опечатка в
 * инструкции подсвечивала бы её всей команде как свежую новость.
 */
export function isUnread(item: AnnouncementView, seenAt: string | null): boolean {
  if (!isVisible(item)) return false;
  if (seenAt === null) return true;
  return (item.publishedAt as string) > seenAt;
}

/** Сколько объявлений участник ещё не видел. Число для значка в шапке. */
export function countUnread(items: readonly AnnouncementView[], seenAt: string | null): number {
  return items.reduce((total, item) => total + (isUnread(item, seenAt) ? 1 : 0), 0);
}

// ─── Разбор текста ──────────────────────────────────────────────────────────

/**
 * Блок текста объявления.
 *
 * Инструкция без списка нечитаема, а тащить ради неё разметку Markdown —
 * это и новая зависимость, и `dangerouslySetInnerHTML` с разбором чужого HTML.
 * Поэтому здесь распознаются ровно три вещи: абзац, маркированный список
 * и нумерованный. Всё остальное остаётся текстом и отрисовывается текстом.
 */
export type AnnouncementBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'steps'; items: string[] };

/** `- пункт`, `* пункт`, `• пункт`. */
const BULLET = /^\s*[-*•]\s+(.*)$/;
/** `1. шаг`, `2) шаг`. */
const STEP = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Текст объявления → блоки.
 *
 * Пустая строка кончает абзац. Строки подряд, не начинающиеся с маркера,
 * склеиваются в один абзац через пробел: перенос в поле ввода — след
 * ширины окна, а не намерение автора.
 */
export function parseAnnouncementBody(body: string): AnnouncementBlock[] {
  const blocks: AnnouncementBlock[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];
  let listKind: 'bullets' | 'steps' | null = null;

  function flush(): void {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (listKind !== null && list.length > 0) {
      blocks.push({ kind: listKind, items: list });
    }
    list = [];
    listKind = null;
  }

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();

    if (line === '') {
      flush();
      continue;
    }

    const bullet = BULLET.exec(line);
    const step = bullet === null ? STEP.exec(line) : null;
    const kind = bullet !== null ? 'bullets' : step !== null ? 'steps' : null;

    if (kind === null) {
      // Абзац после списка — новый блок, а не продолжение пункта.
      if (listKind !== null) flush();
      paragraph.push(line);
      continue;
    }

    // Список после абзаца тоже начинает новый блок; смена вида маркера —
    // тоже: перечисление шагов и перечисление правил читаются по-разному.
    if (paragraph.length > 0 || (listKind !== null && listKind !== kind)) flush();

    listKind = kind;
    list.push(((bullet ?? step) as RegExpExecArray)[1].trim());
  }

  flush();
  return blocks;
}

/**
 * Первые несколько слов объявления — для свёрнутого вида на главной.
 *
 * Обрезается по границе слова, а не по символу: половина слова с многоточием
 * читается как ошибка отрисовки.
 */
export function summarize(body: string, limit = 160): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;

  const cut = flat.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]+$/, '')}…`;
}
