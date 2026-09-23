/**
 * Руководство пользователя (`docs/USER_GUIDE.md`) → блоки для страницы `/guide`.
 *
 * Источник один: тот же файл читают в репозитории и показывает приложение.
 * Две копии — в Markdown и в разметке страницы — однажды разошлись бы, и
 * люди читали бы правила, которых в коде уже нет.
 *
 * Библиотеки Markdown здесь нет по той же причине, что и в объявлениях
 * (§6.12): новая зависимость и разбор HTML ради документа, который пишем мы
 * сами. Распознаётся ровно то, чем пользуется руководство: заголовки трёх
 * уровней, абзацы, маркированные и нумерованные списки, таблицы, блоки кода,
 * горизонтальная черта, а внутри строки — **жирный**, `код` и [ссылка](адрес).
 * Всё остальное остаётся текстом.
 */

export type GuideInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type GuideBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; id: string | null; text: string }
  | { kind: 'paragraph'; content: GuideInline[] }
  | { kind: 'bullets'; items: GuideInline[][] }
  | { kind: 'steps'; items: GuideInline[][] }
  | { kind: 'table'; head: GuideInline[][]; rows: GuideInline[][][] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

/** Раздел руководства: заголовок второго уровня и всё до следующего. */
export type GuideSection = {
  id: string | null;
  title: string;
  blocks: GuideBlock[];
};

export type GuideDocument = {
  title: string;
  /** Абзацы до первого раздела — вводный текст под заголовком страницы. */
  lead: GuideInline[][];
  sections: GuideSection[];
};

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const STEP = /^\d+\.\s+(.*)$/;
const TABLE_ROW = /^\|.*\|$/;
const TABLE_DIVIDER = /^\|(\s*:?-+:?\s*\|)+$/;
/** Номер в начале заголовка: «5.», «5.6». */
const SECTION_NUMBER = /^(\d+(?:\.\d+)*)\.?\s+/;
const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Якорь заголовка — по его номеру: «5.6 Округление» → `s5-6`.
 *
 * Номер, а не текст, потому что на него и ссылается руководство («раздел
 * 5.6»): переформулированный заголовок не должен ломать ссылки на него.
 * Заголовок без номера якоря не получает.
 */
export function headingId(text: string): string | null {
  const match = SECTION_NUMBER.exec(text);
  return match === null ? null : `s${match[1].replace(/\./g, '-')}`;
}

/** Строка → куски: текст, **жирный**, `код`, [ссылка](адрес). */
export function parseInline(line: string): GuideInline[] {
  const result: GuideInline[] = [];
  let last = 0;

  for (const match of line.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) result.push({ kind: 'text', text: line.slice(last, index) });

    if (match[1] !== undefined) result.push({ kind: 'strong', text: match[1] });
    else if (match[2] !== undefined) result.push({ kind: 'code', text: match[2] });
    else result.push({ kind: 'link', text: match[3], href: match[4] });

    last = index + match[0].length;
  }

  if (last < line.length) result.push({ kind: 'text', text: line.slice(last) });
  return result;
}

function tableCells(line: string): GuideInline[][] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

/** Markdown руководства → плоский список блоков. */
export function parseGuideBlocks(source: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  const lines = source.split('\n');

  let paragraph: string[] = [];
  let list: string[] = [];
  let listKind: 'bullets' | 'steps' | null = null;

  function flush(): void {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
    if (listKind !== null && list.length > 0) {
      blocks.push({ kind: listKind, items: list.map(parseInline) });
    }
    list = [];
    listKind = null;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (line === '') {
      flush();
      continue;
    }

    if (line.startsWith('```')) {
      flush();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }

    if (line === '---') {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      flush();
      const text = heading[2].trim();
      blocks.push({
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        id: headingId(text),
        text,
      });
      continue;
    }

    if (TABLE_ROW.test(line)) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        rows.push(lines[i].trim());
        i += 1;
      }
      i -= 1;
      const [head, ...rest] = rows;
      const body = rest.filter((row) => !TABLE_DIVIDER.test(row));
      blocks.push({ kind: 'table', head: tableCells(head), rows: body.map(tableCells) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const step = bullet === null ? STEP.exec(line) : null;
    const kind = bullet !== null ? 'bullets' : step !== null ? 'steps' : null;

    if (kind === null) {
      // Строка с отступом под пунктом списка — продолжение этого пункта.
      if (listKind !== null && lines[i].startsWith(' ')) {
        list[list.length - 1] += ` ${line}`;
        continue;
      }
      if (listKind !== null) flush();
      paragraph.push(line);
      continue;
    }

    if (paragraph.length > 0 || (listKind !== null && listKind !== kind)) flush();
    listKind = kind;
    list.push(((bullet ?? step) as RegExpExecArray)[1].trim());
  }

  flush();
  return blocks;
}

/**
 * Блоки → документ: заголовок страницы, вводный текст и разделы.
 *
 * Черта между разделами в Markdown нужна глазу в редакторе; на странице
 * разделы и так разнесены по карточкам, поэтому черта отбрасывается.
 */
export function parseGuide(source: string): GuideDocument {
  let title = '';
  const lead: GuideInline[][] = [];
  const sections: GuideSection[] = [];

  for (const block of parseGuideBlocks(source)) {
    if (block.kind === 'rule') continue;

    if (block.kind === 'heading' && block.level === 1) {
      title = block.text;
      continue;
    }

    if (block.kind === 'heading' && block.level === 2) {
      sections.push({ id: block.id, title: block.text, blocks: [] });
      continue;
    }

    const current = sections[sections.length - 1];
    if (current !== undefined) current.blocks.push(block);
    else if (block.kind === 'paragraph') lead.push(block.content);
  }

  return { title, lead, sections };
}

/** Все ссылки документа — для проверки, что каждая куда-то ведёт. */
export function guideLinks(blocks: readonly GuideBlock[]): string[] {
  const inlines: GuideInline[] = [];
  for (const block of blocks) {
    if (block.kind === 'paragraph') inlines.push(...block.content);
    if (block.kind === 'bullets' || block.kind === 'steps') inlines.push(...block.items.flat());
    if (block.kind === 'table') inlines.push(...block.head.flat(), ...block.rows.flat(2));
  }
  return inlines.flatMap((inline) => (inline.kind === 'link' ? [inline.href] : []));
}
