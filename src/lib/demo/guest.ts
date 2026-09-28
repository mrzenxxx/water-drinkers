import { randomBytes } from 'node:crypto';

import type { PrismaClient } from '@/generated/prisma/client';
import { credentialFields, generatePassword, type AuthConfig } from '@/lib/auth';
import { writeAudit } from '@/lib/data/audit';
import { fromIsoDate, todayIso } from '@/lib/data/dates';

/**
 * Гость демо-версии: кнопка «Смотреть демо-версию» на проде и тесте ведёт на
 * демо-контур, а тот заводит каждому нажавшему собственного администратора и
 * отдаёт ему магическую ссылку. Общего демо-пароля нет: его бы поменял первый
 * же посетитель, и остальные остались бы за дверью.
 *
 * Гость — администратор, чтобы показать всё приложение, но с нулевым сроком
 * участия (`joinedAt = leftAt`, полуинтервал `[d, d)` пуст, §4.1): воду он не
 * пьёт, и десятый посетитель не сдвигает доли в демонстрационных заказах.
 * Права администратора дата выхода не отнимает — `requireAdmin` смотрит
 * только на роль.
 */

export const DEMO_LOGIN_PREFIX = 'demo-';

/**
 * Предел гостей в час на весь контур. Страница открыта всему интернету, и без
 * предела скрипт в цикле набил бы базу демо тысячами администраторов.
 */
export const DEMO_GUESTS_PER_HOUR = 30;

const HOUR_MS = 60 * 60 * 1000;

export class DemoGuestLimitError extends Error {
  constructor() {
    super('Слишком много гостей демо-версии за последний час. Попробуйте позже.');
    this.name = 'DemoGuestLimitError';
  }
}

/** Контур демо включается переменной окружения, на проде и тесте её нет. */
export function isDemoMode(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.DEMO_MODE === '1';
}

/**
 * Адрес демо-контура для кнопки на странице входа. `null` — кнопки нет: на
 * самом демо и на машине разработчика, где переменная не задана.
 */
export function demoUrlFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const url = env.DEMO_URL?.trim().replace(/\/+$/, '');
  return url ? url : null;
}

/** Логин и имя гостя из случайных байтов: `demo-3fa91c0e`, «Гость 3FA9». */
export function demoGuestIdentity(random: Uint8Array): { login: string; firstName: string; lastName: string } {
  const suffix = Buffer.from(random).toString('hex');
  return {
    login: `${DEMO_LOGIN_PREFIX}${suffix}`,
    firstName: 'Демо',
    lastName: `Гость ${suffix.slice(0, 4).toUpperCase()}`,
  };
}

/**
 * Завести гостя и вернуть его магическую ссылку. Бросает
 * `DemoGuestLimitError`, если предел часа исчерпан.
 */
export async function createDemoGuest(
  db: PrismaClient,
  config: AuthConfig,
  now: Date = new Date(),
  random: Uint8Array = randomBytes(4),
): Promise<string> {
  const recent = await db.user.count({
    where: {
      login: { startsWith: DEMO_LOGIN_PREFIX },
      createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
    },
  });
  if (recent >= DEMO_GUESTS_PER_HOUR) throw new DemoGuestLimitError();

  const identity = demoGuestIdentity(random);
  const today = fromIsoDate(todayIso(now));
  const { data, credentials } = await credentialFields(config, identity.login, generatePassword(), now);

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...data,
        firstName: identity.firstName,
        lastName: identity.lastName,
        role: 'ADMIN',
        joinedAt: today,
        leftAt: today,
      },
    });

    await writeAudit(tx, {
      actorId: null,
      action: 'demo.guest',
      entity: 'user',
      entityId: user.id,
      after: { login: identity.login },
    });
  });

  return credentials.magicLinkUrl;
}
