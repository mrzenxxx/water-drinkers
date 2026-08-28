import { describe, expect, it } from 'vitest';

import {
  isNavLayout,
  isSidebarState,
  nextNavLayout,
  toggledSidebar,
  NAV_INIT_SCRIPT,
  NAV_LAYOUT_KEY,
  SIDEBAR_STATE_KEY,
} from '@/lib/nav-mode';

describe('isNavLayout и isSidebarState', () => {
  it('принимают допустимые значения', () => {
    expect(isNavLayout('sidebar')).toBe(true);
    expect(isNavLayout('tabs')).toBe(true);
    expect(isSidebarState('expanded')).toBe(true);
    expect(isSidebarState('collapsed')).toBe(true);
  });

  it('отвергают мусор из localStorage', () => {
    expect(isNavLayout('')).toBe(false);
    expect(isNavLayout('rail')).toBe(false);
    expect(isNavLayout(null)).toBe(false);
    expect(isSidebarState('open')).toBe(false);
    expect(isSidebarState(undefined)).toBe(false);
  });
});

describe('nextNavLayout', () => {
  it('ходит между двумя формами и возвращается за два нажатия', () => {
    expect(nextNavLayout('sidebar')).toBe('tabs');
    expect(nextNavLayout('tabs')).toBe('sidebar');
    expect(nextNavLayout(nextNavLayout('sidebar'))).toBe('sidebar');
  });
});

describe('toggledSidebar', () => {
  it('из вкладок возвращает развёрнутую панель', () => {
    expect(toggledSidebar({ layout: 'tabs', sidebar: 'collapsed' })).toEqual({
      layout: 'sidebar',
      sidebar: 'expanded',
    });
  });

  it('в режиме панели ходит между «развёрнута» и «свёрнута»', () => {
    const expanded = { layout: 'sidebar', sidebar: 'expanded' } as const;
    expect(toggledSidebar(expanded)).toEqual({ layout: 'sidebar', sidebar: 'collapsed' });
    expect(toggledSidebar(toggledSidebar(expanded))).toEqual(expanded);
  });
});

describe('NAV_INIT_SCRIPT', () => {
  it('использует те же ключи хранилища, что и приложение', () => {
    expect(NAV_INIT_SCRIPT).toContain(NAV_LAYOUT_KEY);
    expect(NAV_INIT_SCRIPT).toContain(SIDEBAR_STATE_KEY);
  });

  it('без сохранённого выбора оставляет развёрнутую боковую панель', () => {
    expect(NAV_INIT_SCRIPT).toContain("'tabs' : 'sidebar'");
    expect(NAV_INIT_SCRIPT).toContain("'collapsed' : 'expanded'");
  });
});
