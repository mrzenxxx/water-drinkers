import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Пароли участников.
 *
 * Пароль выдаёт администратор, поэтому по умолчанию он случайный и длинный.
 * Хранится только отпечаток scrypt с солью: в отличие от кодов входа, где
 * хватало HMAC на секрете, пароль живёт долго и может совпадать с паролями
 * человека в других местах — утечка базы не должна давать его перебором.
 *
 * Формат отпечатка: `scrypt$N$r$p$соль$хеш`, соль и хеш в base64url.
 * Параметры записаны в самой строке, поэтому их можно усилить позже,
 * не ломая уже выданные пароли.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const GENERATED_PASSWORD_LENGTH = 12;

/** Без похожих знаков: пароль переписывают глазами из мессенджера. */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export function generatePassword(random: (max: number) => number = randomInt): string {
  let out = '';
  for (let i = 0; i < GENERATED_PASSWORD_LENGTH; i += 1) {
    out += ALPHABET[random(ALPHABET.length)];
  }
  return out;
}

export function isAcceptablePassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem с запасом: при N=16384, r=8 scrypt просит 16 МБ, это ровно
    // стандартный предел Node, и на нём он падает.
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/** Проверка за постоянное время. Испорченный отпечаток — просто «не подошёл». */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltText, keyText] = parts;
  const params = [Number(n), Number(r), Number(p)];
  if (!params.every((v) => Number.isInteger(v) && v > 0)) return false;

  const expected = Buffer.from(keyText, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, Buffer.from(saltText, 'base64url'), params[0], params[1], params[2]);
  return timingSafeEqual(actual, expected);
}
