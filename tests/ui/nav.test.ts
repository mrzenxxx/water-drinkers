import { describe, expect, it } from 'vitest';

import { isInternalPath } from '@/lib/view/nav';

/**
 * Подсветка разделов проверяется в `timeline.test.ts` — там же, где остальная
 * логика оболочки. Здесь только адрес перехода после сохранения формы: он
 * приходит из браузера, и цена ошибки тут не косметическая.
 */
describe('isInternalPath', () => {
  it('принимает путь от корня', () => {
    expect(isInternalPath('/')).toBe(true);
    expect(isInternalPath('/profile')).toBe(true);
    expect(isInternalPath('/dashboard?period=quarter')).toBe(true);
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
