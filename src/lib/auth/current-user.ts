/**
 * Текущий участник для серверных компонентов.
 *
 * GraphQL читает сессию в своём контексте (`src/graphql/context.ts`), но
 * серверные компоненты ходят в слой данных напрямую, без HTTP к собственному
 * `/api/graphql` (CLAUDE.md, §12а) — и им нужен тот же ответ на вопрос «кто
 * это». Логика подписи cookie при этом одна на оба пути: она лежит в
 * `session.ts`, здесь только её применение к запросу Next.js.
 *
 * Модуль намеренно **не** реэкспортируется из `src/lib/auth/index.ts`: он тянет
 * `next/headers` и `next/navigation`, а ими нельзя пользоваться ни в тестах,
 * ни в резолверах.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { SESSION_COOKIE, authConfigFromEnv, isSessionCurrent, readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { User } from '@/generated/prisma/client';

/**
 * Участник текущего запроса или `null`.
 *
 * Обёрнуто в `cache()` из React: за один рендер страницы обращений к «кто я»
 * бывает с десяток — шапка, боковое меню, сама страница, — и без мемоизации
 * каждое из них означало бы отдельный запрос к базе.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const config = authConfigFromEnv();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  const payload = readSession(token, config.sessionSecret, new Date());
  if (payload === null) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  // Бан и перевыпуск учётных данных отзывают сессию и для страниц, а не только
  // для резолверов: иначе забаненный продолжал бы видеть всё до конца срока cookie.
  if (user === null || !isSessionCurrent(user, payload.iat)) return null;
  return user;
});

/** Участник или переход на вход. Для страниц, закрытых от гостя. */
export async function requirePageUser(): Promise<User> {
  const user = await currentUser();
  if (user === null) redirect('/login');
  return user;
}

/**
 * Администратор или переход на главную.
 *
 * Гостя отправляем на вход, вошедшего участника — на главную: сообщать ему
 * «такая страница есть, но она не для тебя» незачем.
 */
export async function requirePageAdmin(): Promise<User> {
  const user = await currentUser();
  if (user === null) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}

/** Заполнены ли имя и фамилия. Первый вход ведёт на заполнение профиля (§7). */
export function hasProfile(user: User): boolean {
  return (user.firstName ?? '').length > 0 && (user.lastName ?? '').length > 0;
}
