import { GraphQLError } from 'graphql';
import { cookies } from 'next/headers';

import { SESSION_COOKIE, authConfigFromEnv, readSession, sessionCookieOptions } from '@/lib/auth';
import type { AuthConfig } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma/client';
import { createLoaders, type Loaders } from '@/graphql/loaders';
import { loadFundState, todayIso, type FundState } from '@/lib/data';
import type { IsoDate } from '@/lib/calc/types';

/**
 * Контекст резолверов: база, конфигурация входа, текущий участник, лоадеры
 * и пересчёт.
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
  /** Батчинг связей на время запроса (§10.3). Создаются заново на каждый запрос. */
  loaders: Loaders;
  /**
   * Пересчёт балансов, мемоизированный на время запроса.
   *
   * `balances`, `fund` и `User.balance` в одном запросе спрашивают одно и то же;
   * без мемоизации всё считалось бы трижды по трижды вычитанным данным.
   * Сбрасывается мутацией: после подтверждения взноса ответ обязан показывать
   * новый баланс, а не тот, что был посчитан до изменения.
   */
  fundState(): Promise<FundState>;
  /** Забыть посчитанное. Зовётся каждой мутацией, меняющей деньги. */
  invalidateFundState(): void;
  setSessionCookie(token: string): Promise<void>;
  clearSessionCookie(): Promise<void>;
};

export type ContextOptions = {
  request: Request;
  db: PrismaClient;
  config: AuthConfig;
  userId: string | null;
  setSessionCookie(token: string): Promise<void>;
  clearSessionCookie(): Promise<void>;
  /** «Сегодня» для расчёта (§4.3). Отдельным параметром — ради тестов. */
  asOf?: IsoDate;
};

/**
 * Сборка контекста из готовых частей.
 *
 * Вынесено из `createContext`, потому что тот намертво привязан к `cookies()`
 * из Next.js: без Route Handler его не позвать, а резолверы проверять надо.
 */
export function buildContext(options: ContextOptions): GraphQLContext {
  const asOf = options.asOf ?? todayIso();

  // Мемоизация по промису, а не по значению: два резолвера, спросившие
  // одновременно, должны дождаться одного и того же пересчёта.
  let pending: Promise<FundState> | null = null;

  return {
    request: options.request,
    db: options.db,
    config: options.config,
    userId: options.userId,
    loaders: createLoaders(options.db),

    fundState() {
      pending ??= loadFundState(options.db, asOf);
      return pending;
    },

    invalidateFundState() {
      pending = null;
    },

    setSessionCookie: options.setSessionCookie,
    clearSessionCookie: options.clearSessionCookie,
  };
}

export async function createContext(request: Request): Promise<GraphQLContext> {
  const config = authConfigFromEnv();
  const store = await cookies();

  const payload = readSession(store.get(SESSION_COOKIE)?.value, config.sessionSecret, new Date());

  return buildContext({
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
  });
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

  const user = await ctx.loaders.userById.load(ctx.userId);
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
