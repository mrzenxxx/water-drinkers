import { describe, expect, it } from 'vitest';

import {
  CODE_LENGTH,
  MAX_ATTEMPTS,
  canRequestCode,
  codeExpiryFrom,
  codeMatches,
  generateCode,
  hashCode,
  verifyCode,
} from '@/lib/auth/codes';

const SECRET = 'test-secret-not-a-real-one';
const EMAIL = 'e.kondobarov@sspk.spb.ru';
const NOW = new Date('2026-08-14T12:00:00Z');

describe('generateCode', () => {
  it('всегда шесть цифр, включая ведущие нули', () => {
    expect(generateCode(() => 0)).toBe('000000');
    expect(generateCode(() => 42)).toBe('000042');
    expect(generateCode(() => 999999)).toBe('999999');
  });

  it('на настоящем источнике случайности даёт шесть цифр', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode()).toMatch(new RegExp(`^\\d{${CODE_LENGTH}}$`));
    }
  });
});

describe('hashCode', () => {
  it('детерминирован', () => {
    expect(hashCode('123456', EMAIL, SECRET)).toBe(hashCode('123456', EMAIL, SECRET));
  });

  it('не выдаёт код: отпечаток не содержит цифр кода', () => {
    expect(hashCode('123456', EMAIL, SECRET)).not.toContain('123456');
  });

  it('привязан к адресу — код одного участника не подойдёт другому', () => {
    expect(hashCode('123456', EMAIL, SECRET)).not.toBe(
      hashCode('123456', 'i.petrov@sspk.spb.ru', SECRET),
    );
  });

  it('привязан к секрету', () => {
    expect(hashCode('123456', EMAIL, SECRET)).not.toBe(hashCode('123456', EMAIL, 'другой секрет'));
  });

  it('отказывается работать без секрета — пустой секрет это дыра, а не значение по умолчанию', () => {
    expect(() => hashCode('123456', EMAIL, '')).toThrow(/SESSION_SECRET/);
  });
});

describe('codeMatches', () => {
  it('совпадение и несовпадение', () => {
    const h = hashCode('123456', EMAIL, SECRET);
    expect(codeMatches(h, h)).toBe(true);
    expect(codeMatches(hashCode('654321', EMAIL, SECRET), h)).toBe(false);
  });

  it('разная длина не роняет сравнение', () => {
    expect(codeMatches('короткий', hashCode('123456', EMAIL, SECRET))).toBe(false);
  });
});

describe('verifyCode', () => {
  const record = (over: Partial<{ codeHash: string; expiresAt: Date; attempts: number }> = {}) => ({
    codeHash: hashCode('123456', EMAIL, SECRET),
    expiresAt: new Date(NOW.getTime() + 60_000),
    attempts: 0,
    ...over,
  });

  it('принимает верный код', () => {
    expect(verifyCode('123456', EMAIL, SECRET, record(), NOW)).toEqual({ ok: true });
  });

  it('терпит пробелы вокруг введённого кода', () => {
    expect(verifyCode('  123456 ', EMAIL, SECRET, record(), NOW)).toEqual({ ok: true });
  });

  it('отвергает неверный код', () => {
    expect(verifyCode('000000', EMAIL, SECRET, record(), NOW)).toEqual({
      ok: false,
      reason: 'wrong_code',
    });
  });

  it('отвергает, когда кода нет', () => {
    expect(verifyCode('123456', EMAIL, SECRET, null, NOW)).toEqual({ ok: false, reason: 'no_code' });
  });

  it('отвергает просроченный код, даже если он верный', () => {
    const expired = record({ expiresAt: new Date(NOW.getTime() - 1) });
    expect(verifyCode('123456', EMAIL, SECRET, expired, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('срок истекает строго: ровно в момент истечения код уже мёртв', () => {
    const edge = record({ expiresAt: NOW });
    expect(verifyCode('123456', EMAIL, SECRET, edge, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  it('после исчерпания попыток верный код тоже не проходит', () => {
    const burned = record({ attempts: MAX_ATTEMPTS });
    expect(verifyCode('123456', EMAIL, SECRET, burned, NOW)).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('код одного участника не подходит записи другого', () => {
    const foreign = { ...record(), codeHash: hashCode('123456', 'i.petrov@sspk.spb.ru', SECRET) };
    expect(verifyCode('123456', EMAIL, SECRET, foreign, NOW)).toEqual({
      ok: false,
      reason: 'wrong_code',
    });
  });
});

describe('лимиты', () => {
  it('не больше трёх запросов кода в час', () => {
    expect(canRequestCode(0)).toBe(true);
    expect(canRequestCode(2)).toBe(true);
    expect(canRequestCode(3)).toBe(false);
    expect(canRequestCode(99)).toBe(false);
  });

  it('срок жизни кода — 10 минут', () => {
    expect(codeExpiryFrom(NOW).toISOString()).toBe('2026-08-14T12:10:00.000Z');
  });
});
