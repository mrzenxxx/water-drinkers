import { describe, expect, it } from 'vitest';

import { isThemePreference, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from '@/lib/theme';

describe('isThemePreference', () => {
  it('принимает три допустимых значения', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
  });

  it('отвергает мусор из localStorage', () => {
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference('blue')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('использует тот же ключ хранилища, что и приложение', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
  });
});
