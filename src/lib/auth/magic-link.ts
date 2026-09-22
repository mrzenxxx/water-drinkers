import { createHmac, randomBytes } from 'node:crypto';

/**
 * Магическая ссылка — вход без ввода пароля, с любого устройства (ADR-0004).
 *
 * Ссылка многоразовая до срока. Одноразовую съел бы первый же, кто откроет
 * её раньше человека: Telegram и почтовые клиенты заранее загружают адрес
 * ради превью. Ссылка одна на участника: перевыпуск учётных данных заменяет
 * её вместе с паролем, и старая перестаёт работать.
 *
 * В базе лежит только HMAC токена на серверном секрете — как раньше у кодов
 * входа: токен случайный и длинный, медленный хеш здесь ничего не добавил бы,
 * а без секрета украденная база ссылок не даёт.
 */

export const MAGIC_LINK_TTL_DAYS = 7;
const TOKEN_BYTES = 32;

/** Метка домена: тот же секрет подписывает сессии, смешивать их нельзя. */
const HMAC_LABEL = 'waterdrinkers:magic-link:v1';

export function hashMagicToken(token: string, secret: string): string {
  if (secret.length === 0) {
    throw new Error('SESSION_SECRET is empty: refusing to hash magic links without a secret');
  }
  return createHmac('sha256', secret).update(HMAC_LABEL).update('\0').update(token).digest('base64url');
}

export type MagicLink = {
  token: string;
  hash: string;
  expiresAt: Date;
};

export function createMagicLink(secret: string, now: Date): MagicLink {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    token,
    hash: hashMagicToken(token, secret),
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

/** Адрес ссылки. Короткий путь `/l/…` — ссылку пересылают в мессенджере. */
export function magicLinkUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/l/${token}`;
}
