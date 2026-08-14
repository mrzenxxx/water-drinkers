/**
 * Ошибки резолверов.
 *
 * Каждая — `GraphQLError` с кодом в `extensions.code` (§10.3). Обычный `Error`
 * Yoga маскирует под `INTERNAL_SERVER_ERROR`, и клиент не отличает «сумма
 * должна быть положительной» от «сервер упал». Коды перечислены типом, а не
 * пишутся строками по месту: строку легко разойтись с интерфейсом.
 */

import { GraphQLError } from 'graphql';

import { isIsoDate } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import { isKopecks } from '@/lib/money';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ABSENCE_OVERLAP'
  | 'NOT_IMPLEMENTED';

export function graphqlError(message: string, code: ErrorCode, extra: Record<string, unknown> = {}): GraphQLError {
  return new GraphQLError(message, { extensions: { code, ...extra } });
}

export function badInput(message: string, extra: Record<string, unknown> = {}): GraphQLError {
  return graphqlError(message, 'BAD_USER_INPUT', extra);
}

export function notFound(message: string, extra: Record<string, unknown> = {}): GraphQLError {
  return graphqlError(message, 'NOT_FOUND', extra);
}

export function conflict(message: string, extra: Record<string, unknown> = {}): GraphQLError {
  return graphqlError(message, 'CONFLICT', extra);
}

export function forbidden(message: string): GraphQLError {
  return graphqlError(message, 'FORBIDDEN');
}

/**
 * Мутация ещё не реализована. Возвращать выдуманную сущность вместо ответа
 * опаснее, чем честно отказать: клиент принял бы пустышку за настоящие данные.
 */
export function notImplemented(name: string): never {
  throw graphqlError(`Mutation "${name}" is not implemented yet`, 'NOT_IMPLEMENTED');
}

// ─── Проверка входа ────────────────────────────────────────────────────────

/**
 * Скаляр `Date` только приводит значение к строке — проверять формат обязан
 * резолвер. Без этого «01.06.2026» доехало бы до базы и легло туда чем угодно.
 */
export function requireDate(value: string, field: string): IsoDate {
  if (!isIsoDate(value)) {
    throw badInput(`Поле «${field}» должно быть датой в формате ГГГГ-ММ-ДД.`, { field });
  }
  return value;
}

/** Сумма взноса и заказа строго положительна — `CHECK (amount > 0)` в §11. */
export function requirePositiveMoney(value: number, field: string): number {
  if (!isKopecks(value)) {
    throw badInput(`Поле «${field}» должно быть целым числом копеек.`, { field });
  }
  if (value <= 0) {
    throw badInput(`Поле «${field}» должно быть больше нуля.`, { field });
  }
  return value;
}

/**
 * Сумма со знаком: корректировка бывает в обе стороны (§2.3), выплата всегда
 * отрицательна. Здесь проверяется только «целое число копеек» — знак разбирают
 * `requireNonZeroMoney` и `requireNegativeMoney`.
 */
export function requireMoney(value: number, field: string): number {
  if (!isKopecks(value)) {
    throw badInput(`Поле «${field}» должно быть целым числом копеек.`, { field });
  }
  return value;
}

/** Корректировка на ноль — не исправление ошибки, а пустая строка в журнале. */
export function requireNonZeroMoney(value: number, field: string): number {
  if (requireMoney(value, field) === 0) {
    throw badInput(`Поле «${field}» не может быть нулём.`, { field });
  }
  return value;
}

/**
 * Выплата уносит деньги из фонда и потому хранится отрицательной (§2.3).
 * `SETTLEMENT` с положительной суммой — ошибка входных данных и отвергается
 * (§4.5): иначе выплата пополняла бы кассу, а инвариант §5 держался бы
 * на честном слове вызывающей стороны.
 */
export function requireNegativeMoney(value: number, field: string): number {
  if (requireMoney(value, field) >= 0) {
    throw badInput(
      `Поле «${field}» должно быть отрицательным: выплата уносит деньги из фонда (§2.3).`,
      { field, amount: value },
    );
  }
  return value;
}

export function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw badInput(`Поле «${field}» не может быть пустым.`, { field });
  }
  return trimmed;
}

/**
 * Нарушение `EXCLUDE USING gist` на отсутствиях (§11).
 *
 * Prisma не переводит это ограничение в свой код ошибки — доезжает либо
 * `P2010`, либо неизвестная ошибка драйвера. Поэтому опознаём по коду
 * PostgreSQL `23P01`, где бы он ни лежал: в `meta`, в `message` или в причине.
 */
export function isExclusionViolation(error: unknown): boolean {
  const text = describeError(error);
  return text.includes('23P01') || text.includes('exclusion constraint');
}

function describeError(error: unknown): string {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;

  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    if (error.cause !== undefined) parts.push(describeError(error.cause));
  }

  const withMeta = error as { meta?: unknown; code?: unknown };
  if (withMeta.meta !== undefined) parts.push(safeJson(withMeta.meta));
  if (withMeta.code !== undefined) parts.push(String(withMeta.code));

  return parts.join(' ');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
