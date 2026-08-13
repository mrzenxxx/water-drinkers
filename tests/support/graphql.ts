/**
 * Прогон настоящих GraphQL-операций поверх подставного клиента Prisma.
 *
 * Проверяется именно то, чего модульные тесты ядра увидеть не могут: права по
 * ролям, модерация взноса и момент, в который взнос попадает в баланс. Схема,
 * резолверы и скаляры берутся боевые — подменена только база.
 *
 * Запрос идёт через сам Yoga, а не через `graphql()` из пакета `graphql`.
 * Причин две. Первая практическая: у Yoga своя копия `graphql`, и схема,
 * собранная ею, не проходит `instanceof` в чужой копии. Вторая важнее — Yoga
 * маскирует обычные `Error` под `INTERNAL_SERVER_ERROR`, и увидеть настоящий
 * `extensions.code` можно только на этом пути (см. решение в PROGRESS).
 */

import { createYoga } from 'graphql-yoga';

import type { PrismaClient } from '@/generated/prisma/client';
import { buildContext, type GraphQLContext } from '@/graphql/context';
import { schema } from '@/graphql/schema';
import type { AuthConfig } from '@/lib/auth';
import type { IsoDate } from '@/lib/calc/types';

const TEST_CONFIG = {
  appUrl: 'http://localhost:3000',
  sessionSecret: 'test-secret',
  allowedDomain: 'sspk.spb.ru',
} as unknown as AuthConfig;

export type TestContextOptions = {
  db: PrismaClient;
  /** id вошедшего участника; `null` — анонимный запрос. */
  userId?: string | null;
  asOf?: IsoDate;
};

export function testContext(options: TestContextOptions): GraphQLContext {
  return buildContext({
    request: new Request('http://localhost:3000/api/graphql', { method: 'POST' }),
    db: options.db,
    config: TEST_CONFIG,
    userId: options.userId ?? null,
    asOf: options.asOf,
    setSessionCookie: async () => {},
    clearSessionCookie: async () => {},
  });
}

export type GraphQLResponse = {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
};

export type RunOptions = TestContextOptions & {
  variables?: Record<string, unknown>;
  /** Готовый контекст, если тесту важно задать несколько операций одному запросу. */
  context?: GraphQLContext;
};

export async function run(source: string, options: RunOptions): Promise<GraphQLResponse> {
  const context = options.context ?? testContext(options);
  const yoga = createYoga({
    schema,
    context: () => context,
    // Ошибки нужны как есть: тест проверяет коды в extensions (§10.3).
    maskedErrors: false,
    logging: false,
  });

  const response = await yoga.fetch('http://localhost:3000/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: source, variables: options.variables }),
  });

  return (await response.json()) as GraphQLResponse;
}

/** Успешный ответ или понятный провал теста вместо `undefined` в `data`. */
export async function runOk(source: string, options: RunOptions): Promise<Record<string, unknown>> {
  const result = await run(source, options);
  if (result.errors !== undefined && result.errors.length > 0) {
    throw new Error(`GraphQL вернул ошибки: ${result.errors.map((error) => error.message).join('; ')}`);
  }
  return result.data as Record<string, unknown>;
}

/** Код первой ошибки из `extensions.code` (§10.3). */
export function errorCode(result: GraphQLResponse): string | undefined {
  return result.errors?.[0]?.extensions?.code as string | undefined;
}
