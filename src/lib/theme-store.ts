import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

export type ThemeState = {
  /** Что выбрал пользователь. */
  preference: ThemePreference;
  /** Что реально применено к документу. */
  resolved: ResolvedTheme;
};

/**
 * Тема живёт вне React: её ставит скрипт в <head> ещё до гидратации,
 * а системная настройка меняется независимо от рендера. Поэтому здесь
 * маленькое внешнее хранилище под useSyncExternalStore — без эффектов
 * и каскадных перерисовок.
 */
const listeners = new Set<() => void>();

/** Снимок для сервера: там ни localStorage, ни prefers-color-scheme нет. */
const SERVER_STATE: ThemeState = { preference: 'system', resolved: 'light' };

let state: ThemeState | null = null;
let mediaQuery: MediaQueryList | null = null;

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readState(): ThemeState {
  let preference: ThemePreference = 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) preference = stored;
  } catch {
    // Приватный режим или заблокированное хранилище: остаётся системная тема.
  }
  return { preference, resolved: preference === 'system' ? systemTheme() : preference };
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

function refresh(): void {
  const next = readState();
  if (state && next.preference === state.preference && next.resolved === state.resolved) return;
  state = next;
  applyTheme(next.resolved);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', refresh);
    // Выбор темы в соседней вкладке должен долетать и сюда.
    window.addEventListener('storage', refresh);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      mediaQuery?.removeEventListener('change', refresh);
      mediaQuery = null;
      window.removeEventListener('storage', refresh);
    }
  };
}

export function getSnapshot(): ThemeState {
  state ??= readState();
  return state;
}

export function getServerSnapshot(): ThemeState {
  return SERVER_STATE;
}

/**
 * Сменить тему — плавно.
 *
 * Смена темы перекрашивает все переменные сразу, и браузер перерисовывает
 * каждый слой стекла с размытием фона. На телефоне эта перерисовка видна как
 * вспышка: страница будто собирается заново. Поэтому смена идёт через View
 * Transition — браузер снимает старый кадр и растворяет его в новом, а
 * промежуточная перерисовка остаётся за кадром. Длительность задаёт
 * `globals.css` по атрибуту `data-view-transition="theme"`. Где API нет или
 * просили меньше движения, тема меняется сразу.
 */
export function setPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Тема просто не запомнится между визитами.
  }

  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || typeof document.startViewTransition !== 'function') {
    refresh();
    return;
  }

  root.dataset.viewTransition = 'theme';
  const transition = document.startViewTransition(refresh);
  void transition.finished.finally(() => {
    delete root.dataset.viewTransition;
  });
}
