import {
  isNavLayout,
  isSidebarState,
  nextNavLayout,
  toggledSidebar,
  NAV_LAYOUT_KEY,
  SIDEBAR_STATE_KEY,
  type NavMode,
} from '@/lib/nav-mode';

/**
 * Форма навигации живёт вне React — ровно как тема.
 *
 * Источник правды — атрибуты `data-nav` и `data-sidebar` на `<html>`: их
 * ставит скрипт в `<head>` ещё до гидратации, от них же считает ширину CSS.
 * Держать рядом второй экземпляр значения в состоянии React значило бы завести
 * два источника правды, которые однажды разъедутся; здесь React только читает
 * атрибуты через `useSyncExternalStore`.
 */
const listeners = new Set<() => void>();

/** На сервере ни документа, ни хранилища: боковая панель, развёрнутая. */
const SERVER_STATE: NavMode = { layout: 'sidebar', sidebar: 'expanded' };

let state: NavMode | null = null;

function readState(): NavMode {
  const { nav, sidebar } = document.documentElement.dataset;
  return {
    layout: isNavLayout(nav) ? nav : 'sidebar',
    sidebar: isSidebarState(sidebar) ? sidebar : 'expanded',
  };
}

function refresh(): void {
  const next = readState();
  if (state !== null && next.layout === state.layout && next.sidebar === state.sidebar) return;
  state = next;
  for (const listener of listeners) listener();
}

/**
 * Ctrl/⌘ + B — привычное сокращение для боковой панели в редакторах и
 * почтовых клиентах. Обработчик живёт здесь, а не в `useEffect` компонента:
 * это подписка на браузер, такая же как слушатель `storage` рядом, и панель
 * от неё не зависит — сокращение работает, даже когда фокус в глубине страницы.
 */
function onKeyDown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  // Раскладка клавиатуры на ту же клавишу даёт «и»: сокращение обязано
  // работать и по-русски, иначе оно работает через раз.
  if (!['b', 'B', 'и', 'И'].includes(event.key)) return;

  event.preventDefault();
  toggleSidebar();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    // Выбор в соседней вкладке должен долетать и сюда.
    window.addEventListener('storage', refresh);
    window.addEventListener('keydown', onKeyDown);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('keydown', onKeyDown);
    }
  };
}

export function getSnapshot(): NavMode {
  state ??= readState();
  return state;
}

export function getServerSnapshot(): NavMode {
  return SERVER_STATE;
}

function apply(next: NavMode): void {
  const root = document.documentElement;
  root.dataset.nav = next.layout;
  root.dataset.sidebar = next.sidebar;
  try {
    localStorage.setItem(NAV_LAYOUT_KEY, next.layout);
    localStorage.setItem(SIDEBAR_STATE_KEY, next.sidebar);
  } catch {
    // Приватный режим: выбор просто не запомнится между визитами.
  }
  refresh();
}

/** Переключить форму навигации: список слева ⇄ вкладки под шапкой. */
export function toggleNavLayout(): void {
  const mode = getSnapshot();
  apply({ ...mode, layout: nextNavLayout(mode.layout) });
}

/** Свернуть или развернуть боковую панель (Ctrl + B). */
export function toggleSidebar(): void {
  apply(toggledSidebar(getSnapshot()));
}
