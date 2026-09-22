import type { PrismaClient, User } from '@/generated/prisma/client';

import { normalizeLogin } from './login-name';
import { createMagicLink, hashMagicToken, magicLinkUrl } from './magic-link';
import { hashPassword, verifyPassword } from './password';
import { issueSession } from './session';

export * from './login-name';
export * from './magic-link';
export * from './password';
export * from './session';

export type AuthConfig = {
  sessionSecret: string;
  appUrl: string;
};

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 32 characters. Generate one: openssl rand -base64 32',
    );
  }

  return {
    sessionSecret,
    appUrl: env.APP_URL ?? 'http://localhost:3000',
  };
}

/** Неудач подряд до блокировки и её длительность. */
export const MAX_FAILED_LOGINS = 10;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; token: string; user: User }
  | { ok: false; reason: 'invalid' | 'locked' | 'banned' };

/**
 * Вход по логину и паролю.
 *
 * «Нет такого логина», «пароль не выдан» и «неверный пароль» неразличимы:
 * различимый ответ превращает форму входа в справочник участников.
 * Бан сообщается только после верного пароля — угадать по нему, чей это
 * логин, нельзя. Блокировка проверяется до пароля, иначе перебор шёл бы
 * и во время неё.
 */
export async function loginWithPassword(
  db: PrismaClient,
  config: AuthConfig,
  rawLogin: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { login: normalizeLogin(rawLogin) } });

  if (user === null || user.passwordHash === null) {
    // Отпечаток считается и здесь: без этого по времени ответа видно,
    // что логина нет.
    await hashPassword(password);
    return { ok: false, reason: 'invalid' };
  }

  if (user.lockedUntil !== null && user.lockedUntil.getTime() > now.getTime()) {
    return { ok: false, reason: 'locked' };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) : user.lockedUntil,
      },
    });
    return { ok: false, reason: lock ? 'locked' : 'invalid' };
  }

  if (user.restriction === 'BANNED') return { ok: false, reason: 'banned' };

  const fresh =
    user.failedLogins === 0 && user.lockedUntil === null
      ? user
      : await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

  return { ok: true, token: issueSession(user.id, config.sessionSecret, now), user: fresh };
}

export type MagicLoginResult = { ok: true; token: string } | { ok: false };

/** Вход по магической ссылке. Причину отказа наружу не сообщаем. */
export async function loginWithMagicLink(
  db: PrismaClient,
  config: AuthConfig,
  token: string,
  now: Date = new Date(),
): Promise<MagicLoginResult> {
  if (token.length === 0) return { ok: false };

  const user = await db.user.findUnique({
    where: { magicLinkHash: hashMagicToken(token, config.sessionSecret) },
  });

  if (user === null || user.magicLinkExpiresAt === null) return { ok: false };
  if (user.magicLinkExpiresAt.getTime() <= now.getTime()) return { ok: false };
  if (user.restriction === 'BANNED') return { ok: false };

  return { ok: true, token: issueSession(user.id, config.sessionSecret, now) };
}

/** Выданные учётные данные — ровно то, что администратор пересылает человеку. */
export type IssuedCredentials = {
  login: string;
  password: string;
  magicLinkUrl: string;
  magicLinkExpiresAt: Date;
};

/**
 * Поля участника для новых учётных данных: отпечаток пароля, свежая ссылка
 * и отзыв всех прежних входов. Пароль в открытом виде уходит только
 * в `credentials` — в базу и в журнал он не попадает.
 */
export async function credentialFields(
  config: AuthConfig,
  login: string,
  password: string,
  now: Date,
) {
  const link = createMagicLink(config.sessionSecret, now);

  return {
    data: {
      login,
      passwordHash: await hashPassword(password),
      magicLinkHash: link.hash,
      magicLinkExpiresAt: link.expiresAt,
      sessionsValidAfter: now,
      failedLogins: 0,
      lockedUntil: null,
    },
    credentials: {
      login,
      password,
      magicLinkUrl: magicLinkUrl(config.appUrl, link.token),
      magicLinkExpiresAt: link.expiresAt,
    } satisfies IssuedCredentials,
  };
}
