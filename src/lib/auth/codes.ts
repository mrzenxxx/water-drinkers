import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Одноразовые коды входа (§7).
 *
 * Код шестизначный, живёт 10 минут, в базе лежит только его отпечаток.
 *
 * Отпечаток — HMAC-SHA256 на серверном секрете, а не «быстрый» хеш и не bcrypt.
 * Пространство шестизначных кодов — миллион значений: SHA-256 без секрета
 * перебирается по украденной базе за секунды, а bcrypt здесь не нужен, потому
 * что секрет в базе не лежит. Утечка одной только базы кодов не даёт ничего.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 10 * 60;
export const MAX_ATTEMPTS = 5;
export const MAX_REQUESTS_PER_HOUR = 3;

/** Метка домена: тот же секрет подписывает сессии, смешивать их нельзя. */
const HMAC_LABEL = 'waterdrinkers:login-code:v1';

/**
 * Шестизначный код. `randomInt` — криптостойкий источник без смещения;
 * `Math.random` здесь был бы дырой.
 */
export function generateCode(random: (max: number) => number = randomInt): string {
  const value = random(10 ** CODE_LENGTH);
  return String(value).padStart(CODE_LENGTH, '0');
}

/**
 * Отпечаток кода. Адрес входит в подпись, поэтому код, выпущенный для одного
 * адреса, не подойдёт к записи другого даже при совпадении цифр.
 */
export function hashCode(code: string, email: string, secret: string): string {
  if (secret.length === 0) {
    throw new Error('SESSION_SECRET is empty: refusing to hash login codes without a secret');
  }

  return createHmac('sha256', secret)
    .update(HMAC_LABEL)
    .update('\0')
    .update(email.trim().toLowerCase())
    .update('\0')
    .update(code)
    .digest('base64url');
}

/** Сравнение отпечатков за постоянное время — иначе таймингом угадывается код. */
export function codeMatches(candidateHash: string, storedHash: string): boolean {
  const a = Buffer.from(candidateHash, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');

  // timingSafeEqual падает на разной длине, поэтому длину проверяем отдельно.
  // Длина отпечатка постоянна, так что утечки здесь нет.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export type CodeRecord = {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
};

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'no_code' | 'expired' | 'too_many_attempts' | 'wrong_code' };

/**
 * Проверка введённого кода. Чистая функция: состояние приходит аргументами,
 * решение возвращается наружу, запись в базу делает вызывающий код.
 */
export function verifyCode(
  input: string,
  email: string,
  secret: string,
  record: CodeRecord | null,
  now: Date,
): VerifyOutcome {
  if (record === null) return { ok: false, reason: 'no_code' };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  const candidate = hashCode(input.trim(), email, secret);
  if (!codeMatches(candidate, record.codeHash)) return { ok: false, reason: 'wrong_code' };

  return { ok: true };
}

/**
 * Не превышен ли лимит запросов кода: не больше трёх на адрес в час.
 * `recentRequests` — сколько кодов выпущено на этот адрес за последний час.
 */
export function canRequestCode(recentRequests: number): boolean {
  return recentRequests < MAX_REQUESTS_PER_HOUR;
}

export function codeExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + CODE_TTL_SECONDS * 1000);
}
