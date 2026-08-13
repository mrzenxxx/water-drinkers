import type { PrismaClient } from '@/generated/prisma/client';

import {
  MAX_ATTEMPTS,
  canRequestCode,
  codeExpiryFrom,
  generateCode,
  hashCode,
  verifyCode,
} from './codes';
import { createMailer, loginCodeLetter } from './mailer';
import { issueSession } from './session';
import { decideAccess } from './whitelist';

export * from './codes';
export * from './mailer';
export * from './session';
export * from './whitelist';

export type AuthConfig = {
  allowedDomain: string;
  sessionSecret: string;
  appUrl: string;
  mailProvider: string | undefined;
};

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 32 characters. Generate one: openssl rand -base64 32',
    );
  }

  const allowedDomain = env.ALLOWED_EMAIL_DOMAIN ?? '';
  if (allowedDomain.length === 0) {
    throw new Error('ALLOWED_EMAIL_DOMAIN is not set: refusing to accept logins from any domain');
  }

  return {
    allowedDomain,
    sessionSecret,
    appUrl: env.APP_URL ?? 'http://localhost:3000',
    mailProvider: env.MAIL_PROVIDER,
  };
}

/** Сколько секунд ждать, прежде чем код перестанет действовать. */
const CODE_TTL_SECONDS_PUBLIC = 10 * 60;

export type RequestCodeResult = {
  ok: boolean;
  expiresInSeconds: number;
};

/**
 * Запрос кода на почту.
 *
 * Ответ **одинаков** для разрешённого и неразрешённого адреса. Это не
 * перестраховка: различимый ответ превращает форму входа в справочник
 * «кто скидывается на воду», а состав участников — не публичные данные.
 * По той же причине лимит запросов проверяется до решения о допуске.
 */
export async function requestLoginCode(
  db: PrismaClient,
  config: AuthConfig,
  rawEmail: string,
  now: Date = new Date(),
): Promise<RequestCodeResult> {
  const uniform: RequestCodeResult = { ok: true, expiresInSeconds: CODE_TTL_SECONDS_PUBLIC };

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const email = rawEmail.trim().toLowerCase();

  const recentRequests = await db.loginCode.count({
    where: { email, createdAt: { gt: hourAgo } },
  });
  if (!canRequestCode(recentRequests)) return uniform;

  const participants = await db.user.findMany({ select: { email: true } });
  const decision = decideAccess(email, config.allowedDomain, participants.map((p) => p.email));
  if (!decision.allowed) return uniform;

  const code = generateCode();

  await db.loginCode.create({
    data: {
      email: decision.email,
      codeHash: hashCode(code, decision.email, config.sessionSecret),
      expiresAt: codeExpiryFrom(now),
      createdAt: now,
    },
  });

  await createMailer(config.mailProvider).send(loginCodeLetter(decision.email, code));

  return uniform;
}

export type VerifyResult =
  | { ok: true; token: string; userId: string; needsProfile: boolean }
  | { ok: false; reason: 'no_code' | 'expired' | 'too_many_attempts' | 'wrong_code' };

/**
 * Проверка кода и выдача сессии.
 *
 * Здесь ответы уже различимы: человек ввёл код и должен понимать, что
 * произошло — код устарел, исчерпаны попытки или просто опечатка.
 */
export async function verifyLoginCode(
  db: PrismaClient,
  config: AuthConfig,
  rawEmail: string,
  input: string,
  now: Date = new Date(),
): Promise<VerifyResult> {
  const email = rawEmail.trim().toLowerCase();

  const record = await db.loginCode.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  const outcome = verifyCode(input, email, config.sessionSecret, record, now);

  if (!outcome.ok) {
    // Неверный код тратит попытку. Просроченный и исчерпанный — уже нет:
    // счётчик там ничего не защищает, а запись всё равно мертва.
    if (outcome.reason === 'wrong_code' && record !== null) {
      await db.loginCode.update({
        where: { id: record.id },
        data: { attempts: Math.min(record.attempts + 1, MAX_ATTEMPTS) },
      });
    }
    return outcome;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (user === null) {
    // Участника удалили между выпуском кода и вводом — код больше не значит ничего.
    return { ok: false, reason: 'no_code' };
  }

  // Код одноразовый: гасим все выпущенные на этот адрес, а не только сработавший.
  await db.loginCode.deleteMany({ where: { email } });

  await db.identity.upsert({
    where: { provider_providerId: { provider: 'email', providerId: email } },
    create: { provider: 'email', providerId: email, userId: user.id },
    update: {},
  });

  return {
    ok: true,
    token: issueSession(user.id, config.sessionSecret, now),
    userId: user.id,
    needsProfile: user.firstName === null || user.lastName === null,
  };
}
