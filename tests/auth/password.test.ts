import { describe, expect, it } from 'vitest';

import {
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
  hashPassword,
  isAcceptablePassword,
  verifyPassword,
} from '@/lib/auth/password';

describe('generatePassword', () => {
  it('нужной длины и без похожих знаков', () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generatePassword();
      expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
      expect(password).not.toMatch(/[0O1lIo]/);
    }
  });

  it('берёт символы из источника случайности', () => {
    expect(generatePassword(() => 0)).toBe('a'.repeat(GENERATED_PASSWORD_LENGTH));
  });
});

describe('isAcceptablePassword', () => {
  it('не короче восьми символов', () => {
    expect(isAcceptablePassword('1234567')).toBe(false);
    expect(isAcceptablePassword('12345678')).toBe(true);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('верный пароль подходит, неверный — нет', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('correct horsE', stored)).toBe(false);
  });

  it('отпечаток не содержит пароля и солён', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toContain('correct');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
  });

  it('испорченный отпечаток — просто «не подошёл»', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$a$b$c$d$e')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$1$1$AAAA$AAAA')).toBe(false);
  });
});
