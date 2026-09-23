import { describe, expect, it } from 'vitest';

import {
  activeSection,
  isInternalPath,
  navHrefs,
  sectionHrefs,
  sectionTabs,
  ADMIN_SECTION,
  APP_SECTIONS,
  type NavSection,
} from '@/lib/view/nav';

/**
 * Подсветка отдельного пункта проверяется в `timeline.test.ts` — там же, где
 * остальная логика оболочки. Здесь то, что появилось вместе с боковой панелью:
 * принадлежность адреса разделу и набор вкладок внутри него.
 */

const SECTIONS: readonly NavSection[] = [...APP_SECTIONS, ADMIN_SECTION];

describe('isInternalPath', () => {
  it('принимает путь от корня', () => {
    expect(isInternalPath('/')).toBe(true);
    expect(isInternalPath('/profile')).toBe(true);
    expect(isInternalPath('/statistics?period=quarter')).toBe(true);
  });

  it('отвергает уход на чужой сайт', () => {
    expect(isInternalPath('//evil.example')).toBe(false);
    expect(isInternalPath('/\\evil.example')).toBe(false);
    expect(isInternalPath('https://evil.example')).toBe(false);
    expect(isInternalPath('javascript:alert(1)')).toBe(false);
  });

  it('отвергает пустое значение и относительный путь', () => {
    expect(isInternalPath(null)).toBe(false);
    expect(isInternalPath('')).toBe(false);
    expect(isInternalPath('profile')).toBe(false);
  });
});

describe('sectionHrefs', () => {
  it('у раздела без вкладок — один адрес', () => {
    expect(sectionHrefs({ href: '/statistics', label: 'Статистика', icon: 'statistics' })).toEqual([
      '/statistics',
    ]);
  });

  it('у раздела с вкладками — свой адрес и адреса вкладок', () => {
    const fund = SECTIONS.find((section) => section.label === 'Касса');
    expect(sectionHrefs(fund!)).toEqual(['/fund', '/fund', '/orders', '/absences']);
  });
});

describe('activeSection', () => {
  it('главная не забирает подсветку у остальных', () => {
    expect(activeSection('/', SECTIONS)?.label).toBe('Главная');
    expect(activeSection('/orders', SECTIONS)?.label).toBe('Касса');
  });

  it('раздел узнаёт свой адрес по вкладке, а не по общему началу', () => {
    // «Заказы» живут по адресу /orders, а принадлежат разделу «Касса» (/fund):
    // группировка в интерфейсе не обязана повторять дерево маршрутов.
    expect(activeSection('/absences', SECTIONS)?.label).toBe('Касса');
    expect(activeSection('/contributions/all', SECTIONS)?.label).toBe('Взносы');
    expect(activeSection('/contributions', SECTIONS)?.label).toBe('Взносы');
  });

  it('вложенный адрес остаётся в своём разделе', () => {
    expect(activeSection('/admin/journal', SECTIONS)?.label).toBe('Админ-панель');
    expect(activeSection('/admin/notices', SECTIONS)?.label).toBe('Админ-панель');
  });

  it('чужой адрес не подсвечивает ничего', () => {
    expect(activeSection('/profile', SECTIONS)).toBeNull();
    expect(activeSection('/login', SECTIONS)).toBeNull();
  });
});

describe('sectionTabs', () => {
  it('раздел без вкладок не рисует полосу', () => {
    expect(sectionTabs('/', SECTIONS)).toEqual([]);
    expect(sectionTabs('/statistics', SECTIONS)).toEqual([]);
    expect(sectionTabs('/notices', SECTIONS)).toEqual([]);
  });

  it('внутри раздела показывает все его вкладки, откуда бы ни зашли', () => {
    const labels = (pathname: string): string[] =>
      sectionTabs(pathname, SECTIONS).map((tab) => tab.label);

    expect(labels('/contributions')).toEqual(['Мои взносы', 'Все взносы']);
    expect(labels('/contributions/all')).toEqual(['Мои взносы', 'Все взносы']);
    expect(labels('/orders')).toEqual(['Фонд', 'Заказы', 'Отсутствия']);
    expect(labels('/admin/queue')).toEqual([
      'Очередь',
      'Участники',
      'Ввод за участника',
      'Журнал',
      'Объявления',
    ]);
  });

  it('вне разделов вкладок нет', () => {
    expect(sectionTabs('/profile', SECTIONS)).toEqual([]);
  });
});

describe('navHrefs', () => {
  it('собирает адреса всех разделов и вкладок', () => {
    const hrefs = navHrefs(SECTIONS);
    for (const href of ['/', '/notices', '/contributions/all', '/orders', '/admin/journal']) {
      expect(hrefs).toContain(href);
    }
  });
});
