import { describe, expect, it } from 'vitest';

import {
  SESSION_TTL_SECONDS,
  issueSession,
  readSession,
  sessionCookieOptions,
} from '@/lib/auth/session';

const SECRET = 'test-secret-not-a-real-one';
const USER = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-08-14T12:00:00Z');

describe('issueSession / readSession', () => {
  it('выданная cookie читается обратно', () => {
    const token = issueSession(USER, SECRET, NOW);
    expect(readSession(token, SECRET, NOW)?.uid).toBe(USER);
  });

  it('живёт 30 дней', () => {
    const token = issueSession(USER, SECRET, NOW);
    const almost = new Date(NOW.getTime() + (SESSION_TTL_SECONDS - 1) * 1000);
    const past = new Date(NOW.getTime() + (SESSION_TTL_SECONDS + 1) * 1000);

    expect(readSession(token, SECRET, almost)).not.toBeNull();
    expect(readSession(token, SECRET, past)).toBeNull();
  });

  it('отказывается выдавать неподписанную сессию', () => {
    expect(() => issueSession(USER, '', NOW)).toThrow(/SESSION_SECRET/);
  });
});

describe('readSession отвергает подделки', () => {
  const token = issueSession(USER, SECRET, NOW);

  it('чужой секрет', () => {
    expect(readSession(token, 'другой секрет', NOW)).toBeNull();
  });

  it('подменённый идентификатор участника при сохранённой подписи', () => {
    // Ровно та атака, ради которой подпись и нужна: сам себе выписать чужой uid.
    const [, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: 'чужой-id', exp: Math.floor(NOW.getTime() / 1000) + 3600 }),
      'utf8',
    ).toString('base64url');

    expect(readSession(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('испорченная подпись', () => {
    const [payload] = token.split('.');
    expect(readSession(`${payload}.мусор`, SECRET, NOW)).toBeNull();
  });

  it('мусор вместо cookie', () => {
    for (const bad of [undefined, '', '.', 'без-точки', '.только-подпись', 'только-payload.']) {
      expect(readSession(bad, SECRET, NOW), String(bad)).toBeNull();
    }
  });

  it('валидная подпись, но не тот формат payload', () => {
    // Подписываем корректно, но кладём внутрь бессмыслицу.
    const junk = Buffer.from(JSON.stringify({ nope: 1 }), 'utf8').toString('base64url');
    const signed = issueSession(USER, SECRET, NOW);
    const [, realSignature] = signed.split('.');
    expect(readSession(`${junk}.${realSignature}`, SECRET, NOW)).toBeNull();
  });

  it('пустой секрет не открывает дверь', () => {
    expect(readSession(token, '', NOW)).toBeNull();
  });
});

describe('sessionCookieOptions', () => {
  it('всегда httpOnly и lax', () => {
    const opts = sessionCookieOptions('http://localhost:3000');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
  });

  it('secure включается только под https, иначе локальная разработка сломается', () => {
    expect(sessionCookieOptions('http://localhost:3000').secure).toBe(false);
    expect(sessionCookieOptions('https://water.sspk.spb.ru').secure).toBe(true);
  });
});
