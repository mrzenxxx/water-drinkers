import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { guideLinks, headingId, parseGuide, parseGuideBlocks, parseInline } from '@/lib/view/guide';

/**
 * Руководство пользователя (`docs/USER_GUIDE.md`) и его разбор для `/guide`.
 *
 * Кроме самого разбора здесь проверяется настоящий документ: каждая ссылка в
 * нём ведёт на существующую страницу приложения или на заголовок того же
 * документа. Переименовали маршрут или перенумеровали раздел — тест скажет,
 * какая ссылка в руководстве повисла.
 */

describe('headingId', () => {
  it('builds the anchor from the section number', () => {
    expect(headingId('5. Как делится')).toBe('s5');
    expect(headingId('5.6 Округление до копейки')).toBe('s5-6');
  });

  it('leaves unnumbered headings without an anchor', () => {
    expect(headingId('Вход')).toBeNull();
  });
});

describe('parseInline', () => {
  it('splits text, bold, code and links', () => {
    expect(parseInline('Откройте **Фонд**, логин `e.kondobarov`, см. [раздел 7](#s7).')).toEqual([
      { kind: 'text', text: 'Откройте ' },
      { kind: 'strong', text: 'Фонд' },
      { kind: 'text', text: ', логин ' },
      { kind: 'code', text: 'e.kondobarov' },
      { kind: 'text', text: ', см. ' },
      { kind: 'link', text: 'раздел 7', href: '#s7' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps a plain line as one text piece', () => {
    expect(parseInline('Просто текст')).toEqual([{ kind: 'text', text: 'Просто текст' }]);
  });
});

describe('parseGuideBlocks', () => {
  it('joins wrapped lines of a paragraph and of a list item', () => {
    const blocks = parseGuideBlocks('Первая строка\nвторая строка\n\n- пункт\n  продолжение\n- второй');
    expect(blocks).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: 'Первая строка вторая строка' }] },
      {
        kind: 'bullets',
        items: [[{ kind: 'text', text: 'пункт продолжение' }], [{ kind: 'text', text: 'второй' }]],
      },
    ]);
  });

  it('reads numbered steps', () => {
    expect(parseGuideBlocks('1. один\n2. два')).toEqual([
      { kind: 'steps', items: [[{ kind: 'text', text: 'один' }], [{ kind: 'text', text: 'два' }]] },
    ]);
  });

  it('reads a table without its divider row', () => {
    const [table] = parseGuideBlocks('| А | Б |\n|---|:---:|\n| 1 | 2 |');
    expect(table).toEqual({
      kind: 'table',
      head: [[{ kind: 'text', text: 'А' }], [{ kind: 'text', text: 'Б' }]],
      rows: [[[{ kind: 'text', text: '1' }], [{ kind: 'text', text: '2' }]]],
    });
  });

  it('keeps a code block verbatim, markers included', () => {
    expect(parseGuideBlocks('```\n**не жирный**\n  - не список\n```')).toEqual([
      { kind: 'code', text: '**не жирный**\n  - не список' },
    ]);
  });
});

describe('parseGuide', () => {
  it('splits the document into a title, a lead and sections, dropping rules', () => {
    const guide = parseGuide('# Руководство\n\nВводный текст.\n\n---\n\n## 1. Раздел\n\nТекст.\n\n### 1.1 Пункт');
    expect(guide.title).toBe('Руководство');
    expect(guide.lead).toEqual([[{ kind: 'text', text: 'Вводный текст.' }]]);
    expect(guide.sections).toEqual([
      {
        id: 's1',
        title: '1. Раздел',
        blocks: [
          { kind: 'paragraph', content: [{ kind: 'text', text: 'Текст.' }] },
          { kind: 'heading', level: 3, id: 's1-1', text: '1.1 Пункт' },
        ],
      },
    ]);
  });
});

// ─── Настоящий документ ─────────────────────────────────────────────────────

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'src/app');

/** Адреса всех страниц приложения: `src/app/(app)/fund/page.tsx` → `/fund`. */
function appRoutes(dir = APP_DIR): string[] {
  const routes: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      routes.push(...appRoutes(path));
    } else if (name === 'page.tsx') {
      const segments = relative(APP_DIR, dir)
        .split(sep)
        .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment));
      routes.push(`/${segments.join('/')}`);
    }
  }
  return routes;
}

describe('docs/USER_GUIDE.md', () => {
  const source = readFileSync(join(ROOT, 'docs/USER_GUIDE.md'), 'utf8');
  const blocks = parseGuideBlocks(source);
  const links = guideLinks(blocks);

  it('has a title and numbered sections', () => {
    const guide = parseGuide(source);
    expect(guide.title).not.toBe('');
    expect(guide.sections.length).toBeGreaterThan(0);
    expect(guide.sections.every((section) => section.id !== null)).toBe(true);
  });

  it('links only to pages that exist', () => {
    const routes = new Set(appRoutes());
    const pages = links.filter((href) => href.startsWith('/'));
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((href) => !routes.has(href))).toEqual([]);
  });

  it('links only to headings that exist', () => {
    const ids = new Set(blocks.flatMap((block) => (block.kind === 'heading' && block.id ? [block.id] : [])));
    const anchors = links.filter((href) => href.startsWith('#'));
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter((href) => !ids.has(href.slice(1)))).toEqual([]);
  });

  it('has no links outside the app', () => {
    expect(links.filter((href) => !href.startsWith('/') && !href.startsWith('#'))).toEqual([]);
  });
});
