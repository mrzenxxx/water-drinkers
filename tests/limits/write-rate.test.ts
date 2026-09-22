import { describe, expect, it } from 'vitest';

import { checkWriteRate } from '@/lib/rate-limit';

const NOW = new Date('2026-09-23T12:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe('checkWriteRate', () => {
  it('без записей — можно', () => {
    expect(checkWriteRate([], NOW)).toEqual({ ok: true });
  });

  it('запись меньше часа назад — ждать до истечения часа', () => {
    expect(checkWriteRate([ago(20)], NOW)).toEqual({ ok: false, retryAt: ago(20 - 60) });
  });

  it('одна запись больше часа назад — можно', () => {
    expect(checkWriteRate([ago(61)], NOW)).toEqual({ ok: true });
  });

  it('ровно час назад — окно уже закрыто', () => {
    expect(checkWriteRate([ago(60)], NOW)).toEqual({ ok: true });
  });

  it('две записи за сутки — ждать, пока выйдет старшая', () => {
    const decision = checkWriteRate([ago(300), ago(120)], NOW);
    expect(decision).toEqual({ ok: false, retryAt: ago(300 - 24 * 60) });
  });

  it('записи старше суток не считаются', () => {
    expect(checkWriteRate([ago(25 * 60), ago(24 * 60 + 1), ago(90)], NOW)).toEqual({ ok: true });
  });

  it('из двух ограничений берётся более позднее', () => {
    // Две за сутки, и последняя — 10 минут назад: часовое окно освободится
    // раньше суточного, ждать нужно суточного.
    const decision = checkWriteRate([ago(600), ago(10)], NOW);
    expect(decision).toEqual({ ok: false, retryAt: ago(600 - 24 * 60) });
  });

  it('порядок входа не важен', () => {
    expect(checkWriteRate([ago(10), ago(600)], NOW)).toEqual(checkWriteRate([ago(600), ago(10)], NOW));
  });
});
