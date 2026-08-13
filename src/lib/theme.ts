export const THEME_STORAGE_KEY = 'waterdrinkers-theme';

/** Выбор пользователя. `system` — следовать prefers-color-scheme. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Тема, которая в итоге применена к документу. */
export type ResolvedTheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Скрипт выставляет data-theme до первой отрисовки, поэтому тёмная тема
 * не мигает светлой на загрузке. Выполняется синхронно в <head>,
 * до гидратации React, — значит, обходится без него.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;
