import { GraphQLError } from 'graphql';
import { cookies } from 'next/headers';

import { SESSION_COOKIE, authConfigFromEnv, readSession, sessionCookieOptions } from '@/lib/auth';
import type { AuthConfig } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma/client';

/**
 * Контекст резолверов: база, конфигурация входа и текущий участник.
 *
 * Сессия читается здесь один раз за запрос, а не в каждом резолвере —
 * иначе проверка подписи легко окажется забытой ровно в том резолвере,
 * где она была нужна.
 */
export type GraphQLContext = {
  request: Request;
  db: PrismaClient;
  config: AuthConfig;
  /** id участника, если cookie валидна. */
  userId: string | null;
  setSessionCookie(token: string): Promise<void>;
  clearSessionCookie(): Promise<void>;
};

export async function createContext(request: Request): Promise<GraphQLContext> {
  const config = authConfigFromEnv();
  const store = await cookies();

  const payload = readSession(store.get(SESSION_COOKIE)?.value, config.sessionSecret, new Date());

  return {
    request,
    db: prisma,
    config,
    userId: payload?.uid ?? null,

    async setSessionCookie(token: string) {
      (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(config.appUrl));
    },

    async clearSessionCookie() {
      (await cookies()).delete(SESSION_COOKIE);
    },
  };
}

/**
 * Ошибки доступа бросаются именно как `GraphQLError`.
 *
 * Обычный Error Yoga маскирует под «Unexpected error» с кодом
 * INTERNAL_SERVER_ERROR — и клиент не может отличить «войди заново»
 * от «сервер упал». Проверено живым запросом, а не только типами.
 */
function authError(message: string, code: 'UNAUTHENTICATED' | 'FORBIDDEN'): never {
  throw new GraphQLError(message, { extensions: { code } });
}

/** Текущий участник или ошибка. Использовать во всём, что требует входа. */
export async function requireUser(ctx: GraphQLContext) {
  if (ctx.userId === null) {
    authError('Требуется вход.', 'UNAUTHENTICATED');
  }

  const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
  if (user === null) {
    // Cookie подписана верно, но участника уже нет.
    authError('Требуется вход.', 'UNAUTHENTICATED');
  }

  return user;
}

export async function requireAdmin(ctx: GraphQLContext) {
  const user = await requireUser(ctx);
  if (user.role !== 'ADMIN') {
    authError('Действие доступно только администратору.', 'FORBIDDEN');
  }
  return user;
}
