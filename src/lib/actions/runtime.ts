/**
 * Общая машинерия серверных действий.
 *
 * Действие не ходит по HTTP к собственному `/api/graphql` (CLAUDE.md, §12а),
 * а вызывает резолвер напрямую — в том же процессе, с тем же контекстом.
 * Резолвер повторно использовать важнее, чем написать в действии свой запрос
 * к Prisma: в нём уже лежат проверки прав, транзакции, запись в журнал аудита
 * и сброс пересчёта. Дубль этой логики разъехался бы с оригиналом на первой же
 * правке — а разъехавшись, тихо сломал бы инвариант §5.
 *
 * Файл намеренно **без** `'use server'`: он экспортирует типы и хелперы,
 * а модуль серверных действий обязан экспортировать только асинхронные функции.
 */

import { GraphQLError } from 'graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { cookies } from 'next/headers';

import { buildContext, type GraphQLContext } from '@/graphql/context';
import { SESSION_COOKIE, authConfigFromEnv, readSession, sessionCookieOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { failure, type ActionState } from './state';

export type { ActionState } from './state';
export { IDLE, failure, success } from './state';

/**
 * Контекст резолверов для серверного действия.
 *
 * Повторяет `createContext`, но не может им быть: тот принимает `Request`
 * из Route Handler, которого у действия нет. Сессия читается той же функцией
 * `readSession` — проверка подписи cookie остаётся в одном месте.
 */
export async function actionContext(): Promise<GraphQLContext> {
  const config = authConfigFromEnv();
  const store = await cookies();
  const payload = readSession(store.get(SESSION_COOKIE)?.value, config.sessionSecret, new Date());

  return buildContext({
    // Резолверы `request` не читают — он лежит в контексте для будущих нужд
    // (адрес клиента, заголовки). Подставляем честную заглушку, а не `null`,
    // чтобы тип контекста не пришлось ослаблять ради одного поля.
    request: new Request('http://localhost/server-action'),
    db: prisma,
    config,
    userId: payload?.uid ?? null,
    sessionIssuedAt: payload?.iat ?? 0,

    async setSessionCookie(token: string) {
      (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(config.appUrl));
    },

    async clearSessionCookie() {
      (await cookies()).delete(SESSION_COOKIE);
    },
  });
}

/**
 * Резолверы не читают четвёртый аргумент — сведения о запросе GraphQL.
 * Собирать его вручную ради вызова в том же процессе значило бы городить
 * фальшивый документ запроса; проще честно передать «его нет».
 */
const NO_RESOLVE_INFO = undefined as unknown as GraphQLResolveInfo;

type ResolverFn<TArgs, TResult> = (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

/**
 * Вызов резолвера с готовым контекстом.
 *
 * `MutationResolvers` допускает и функцию, и объект с полем `resolve`, поэтому
 * форма проверяется в рантайме: молчаливое `as` спрятало бы опечатку в имени.
 */
export async function callResolver<TArgs, TResult>(
  resolver: unknown,
  args: TArgs,
  context: GraphQLContext,
): Promise<TResult> {
  if (typeof resolver !== 'function') {
    throw new TypeError('резолвер должен быть функцией');
  }
  return (resolver as ResolverFn<TArgs, TResult>)(undefined, args, context, NO_RESOLVE_INFO);
}

/**
 * Ошибка резолвера → состояние формы.
 *
 * `GraphQLError` уже несёт человеческую формулировку и типизированный код
 * (§10.3) — их и показываем. Всё остальное — настоящий сбой: подробности
 * уходят в лог сервера, наружу идёт нейтральная фраза.
 */
export function toActionState(error: unknown, fallback: string): ActionState {
  if (error instanceof GraphQLError) {
    const code = error.extensions?.code;
    return failure(error.message, typeof code === 'string' ? code : undefined);
  }

  console.error('[waterdrinkers] серверное действие упало:', error);
  return failure(fallback);
}

// ─── Разбор полей формы ────────────────────────────────────────────────────

/** Обязательная строка из `FormData`. */
export function requiredField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Необязательная строка: пустая превращается в `null`, а не в `''`. */
export function optionalField(form: FormData, name: string): string | null {
  const value = requiredField(form, name);
  return value === '' ? null : value;
}
