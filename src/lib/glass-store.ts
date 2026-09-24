import { GLASS_STORAGE_KEY, isGlassStyle, type GlassStyle } from '@/lib/glass';

/**
 * Вид стекла вне React — по той же причине, что и тема (`theme-store.ts`):
 * его ставит скрипт в `<head>` до гидратации, а меняться он может из
 * соседней вкладки. Маленькое внешнее хранилище под `useSyncExternalStore`.
 */
const listeners = new Set<() => void>();

let current: GlassStyle | null = null;

function read(): GlassStyle {
  try {
    const stored = localStorage.getItem(GLASS_STORAGE_KEY);
    if (isGlassStyle(stored)) return stored;
  } catch {
    // Приватный режим или заблокированное хранилище: остаётся матовое.
  }
  return 'matte';
}

function apply(style: GlassStyle): void {
  document.documentElement.dataset.glass = style;
}

function refresh(): void {
  const next = read();
  if (next === current) return;
  current = next;
  apply(next);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', refresh);
  };
}

export function getSnapshot(): GlassStyle {
  current ??= read();
  return current;
}

export function getServerSnapshot(): GlassStyle {
  return 'matte';
}

/**
 * Сменить вид стекла плавно.
 *
 * Разница между видами — блики и тени на сотне элементов сразу, и переходом
 * каждого свойства её не передать: фон-градиент не анимируется вовсе. Поэтому
 * смена идёт через View Transition — браузер снимает старую страницу и
 * медленно растворяет её в новой. Тип перехода помечен атрибутом
 * `data-view-transition="glass"`: по нему `globals.css` удлиняет растворение,
 * не трогая прочие переходы. Где API нет или человек просил меньше движения,
 * вид меняется сразу.
 */
export function setGlass(style: GlassStyle): void {
  try {
    localStorage.setItem(GLASS_STORAGE_KEY, style);
  } catch {
    // Выбор просто не запомнится между визитами.
  }

  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || typeof document.startViewTransition !== 'function') {
    refresh();
    return;
  }

  root.dataset.viewTransition = 'glass';
  const transition = document.startViewTransition(refresh);
  void transition.finished.finally(() => {
    delete root.dataset.viewTransition;
  });
}
