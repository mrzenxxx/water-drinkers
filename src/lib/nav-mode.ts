export const NAV_LAYOUT_KEY = 'waterdrinkers-nav-layout';
export const SIDEBAR_STATE_KEY = 'waterdrinkers-sidebar';

/**
 * Форма навигации на широком экране.
 *
 * `sidebar` — вертикальный список слева, `tabs` — строка вкладок под шапкой.
 * Это не два разных меню, а два вида одного и того же списка разделов:
 * выбирает человек, а не экран. На узком экране выбора нет — там разделы
 * всегда живут в выезжающем ящике, строке для них не хватит ширины.
 */
export type NavLayout = 'sidebar' | 'tabs';

/**
 * Состояние боковой панели.
 *
 * `expanded` — значки с подписями, содержимое отодвинуто вправо.
 * `collapsed` — узкая полоса одних значков; подписи возвращаются, стоит
 * подвести к ней курсор или увести туда фокус, и панель раскрывается
 * **поверх** содержимого, не сдвигая его.
 */
export type SidebarState = 'expanded' | 'collapsed';

export type NavMode = { layout: NavLayout; sidebar: SidebarState };

export function isNavLayout(value: unknown): value is NavLayout {
  return value === 'sidebar' || value === 'tabs';
}

export function isSidebarState(value: unknown): value is SidebarState {
  return value === 'expanded' || value === 'collapsed';
}

/** Следующая форма навигации для кнопки-переключателя. */
export function nextNavLayout(layout: NavLayout): NavLayout {
  return layout === 'sidebar' ? 'tabs' : 'sidebar';
}

/**
 * Что делает Ctrl/⌘ + B — привычное «показать или спрятать боковую панель».
 *
 * Из вкладок сокращение возвращает панель развёрнутой: человек просит панель,
 * а не полосу значков. Дальше оно ходит между «развёрнута» и «свёрнута».
 */
export function toggledSidebar(mode: NavMode): NavMode {
  if (mode.layout === 'tabs') return { layout: 'sidebar', sidebar: 'expanded' };
  return {
    layout: 'sidebar',
    sidebar: mode.sidebar === 'collapsed' ? 'expanded' : 'collapsed',
  };
}

/**
 * Скрипт выставляет data-nav и data-sidebar до первой отрисовки — по той же
 * причине, по которой это делает скрипт темы: ширина панели участвует в
 * вёрстке страницы, и без неё свёрнутая панель на мгновение раскрывалась бы
 * во всю ширину, а содержимое прыгало бы влево уже после гидратации.
 *
 * Без JavaScript атрибутов нет вовсе, и CSS оставляет развёрнутую боковую
 * панель: состояние по умолчанию — то, в котором видны все подписи.
 */
export const NAV_INIT_SCRIPT = `
(function () {
  var root = document.documentElement;
  try {
    var layout = localStorage.getItem('${NAV_LAYOUT_KEY}');
    var sidebar = localStorage.getItem('${SIDEBAR_STATE_KEY}');
    root.dataset.nav = layout === 'tabs' ? 'tabs' : 'sidebar';
    root.dataset.sidebar = sidebar === 'collapsed' ? 'collapsed' : 'expanded';
  } catch (error) {
    root.dataset.nav = 'sidebar';
    root.dataset.sidebar = 'expanded';
  }
})();
`;
