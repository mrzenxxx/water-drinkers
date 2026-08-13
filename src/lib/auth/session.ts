import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Сессия — подписанная cookie без строки в базе (§7).
 *
 * В схеме §11 таблицы сессий нет, и заводить её ради приложения на полтора
 * десятка человек незачем: cookie подписана HMAC на серверном секрете,
 * подделать её нельзя, а выход — это удаление cookie.
 *
 * Плата за это одна и её стоит знать: отозвать конкретную сессию удалённо
 * нельзя, отзывается только весь набор — сменой SESSION_SECRET.
 */

const HMAC_LABEL = 'waterdrinkers:session:v1';

export const SESSION_COOKIE = 'wd_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type SessionPayload = {
  /** id участника */
  uid: string;
  /** момент истечения, unix-секунды */
  exp: number;
};

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(HMAC_LABEL).update('\0').update(payload).digest('base64url');
}

export function issueSession(userId: string, secret: string, now: Date): string {
  if (secret.length === 0) {
    throw new Error('SESSION_SECRET is empty: refusing to issue an unsigned session');
  }

  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

/**
 * Разбор cookie. `null` на любом отклонении — испорченной, поддельной,
 * просроченной. Причину наружу не сообщаем: клиенту она не нужна, а
 * различимые ответы помогают подбирать подпись.
 */
export function readSession(token: string | undefined, secret: string, now: Date): SessionPayload | null {
  if (token === undefined || token.length === 0 || secret.length === 0) return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = Buffer.from(sign(encoded, secret), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const { uid, exp } = payload as Record<string, unknown>;
  if (typeof uid !== 'string' || uid.length === 0) return null;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;

  if (exp * 1000 <= now.getTime()) return null;

  return { uid, exp };
}

/** Атрибуты cookie. `secure` — только под https, иначе локальная разработка сломается. */
export function sessionCookieOptions(appUrl: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: appUrl.startsWith('https://'),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
