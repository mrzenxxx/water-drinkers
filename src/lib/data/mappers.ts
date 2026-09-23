/**
 * Строки таблиц → чистые типы ядра расчёта.
 *
 * Ядро (`src/lib/calc/`) ничего не знает ни про Prisma, ни про базу — правило 5
 * CLAUDE.md. Весь перевод собран здесь: `BIGINT` → копейки (`money.ts`),
 * `DATE` → `YYYY-MM-DD` (`dates.ts`), `TEXT`-перечисления → размеченные типы.
 *
 * Обратного направления тут нет: писать в базу умеют мутации, и они собирают
 * данные сами. Односторонний слой проще держать честным.
 */

import type {
  Absence as PrismaAbsence,
  Contribution as PrismaContribution,
  FundSettings as PrismaFundSettings,
  FundTransaction as PrismaFundTransaction,
  User as PrismaUser,
  WaterOrder as PrismaWaterOrder,
} from '@/generated/prisma/client';
import type {
  Absence,
  AbsenceType,
  Contribution,
  ContributionStatus,
  FundSettings,
  FundTransaction,
  ManualTransactionType,
  Participant,
  WaterOrder,
} from '@/lib/calc/types';

import { instantToIsoDate, toIsoDate, toIsoDateOrNull } from './dates';
import { toKopecks } from './money';

/**
 * Умолчания строки `fund_settings`, когда её ещё нет.
 *
 * Совпадают с DEFAULT из §11. Пустая база — это законный «чистый запуск»
 * (§4.2), а не ошибка, поэтому падать здесь нечем.
 */
export const DEFAULT_FUND_SETTINGS: FundSettings = {
  openingBalance: 0,
  startDate: null,
  defaultContribution: 50_000,
};

export function toFundSettings(row: PrismaFundSettings | null): FundSettings {
  if (row === null) return DEFAULT_FUND_SETTINGS;

  return {
    openingBalance: toKopecks(row.openingBalance, 'начальное сальдо фонда'),
    startDate: toIsoDateOrNull(row.startDate),
    defaultContribution: toKopecks(row.defaultContribution, 'типовой взнос'),
  };
}

export function toParticipant(row: PrismaUser): Participant {
  return {
    id: row.id,
    joinedAt: toIsoDate(row.joinedAt),
    leftAt: toIsoDateOrNull(row.leftAt),
    openingBalance: toKopecks(row.openingBalance, `начальное сальдо ${row.id}`),
  };
}

/** Значения `absences.type` из §11. Всё прочее — испорченная строка, а не «другой отпуск». */
const ABSENCE_TYPES = new Set<string>(['VACATION', 'SICK_LEAVE']);

export function toAbsenceType(value: string): AbsenceType {
  if (!ABSENCE_TYPES.has(value)) {
    throw new RangeError(`неизвестный тип отсутствия "${value}"`);
  }
  return value as AbsenceType;
}

export function toAbsence(row: PrismaAbsence): Absence {
  return {
    id: row.id,
    userId: row.userId,
    type: toAbsenceType(row.type),
    startsOn: toIsoDate(row.startsOn),
    endsOn: toIsoDate(row.endsOn),
  };
}

export function toWaterOrder(row: PrismaWaterOrder): WaterOrder {
  return {
    id: row.id,
    amount: toKopecks(row.amount, `сумма заказа ${row.id}`),
    orderedAt: toIsoDate(row.orderedAt),
    historical: row.historical,
  };
}

const CONTRIBUTION_STATUSES = new Set<string>(['PENDING', 'CONFIRMED', 'RECORDED', 'REJECTED']);

export function toContributionStatus(value: string): ContributionStatus {
  if (!CONTRIBUTION_STATUSES.has(value)) {
    throw new RangeError(`неизвестный статус взноса "${value}"`);
  }
  return value as ContributionStatus;
}

export function toContribution(row: PrismaContribution): Contribution {
  return {
    id: row.id,
    userId: row.userId,
    amount: toKopecks(row.amount, `сумма взноса ${row.id}`),
    paidAt: toIsoDate(row.paidAt),
    status: toContributionStatus(row.status),
    historical: row.historical,
  };
}

/**
 * В ядро попадают только `SETTLEMENT` и `ADJUSTMENT`.
 *
 * `OPENING`, `CONTRIBUTION` и `ORDER` ядро выводит из `fund_settings`,
 * `contributions` и `water_orders` (см. `ManualTransactionType` в calc/types).
 * Передать их ещё и журналом — значит посчитать каждую операцию дважды.
 */
const MANUAL_TRANSACTION_TYPES = new Set<string>(['SETTLEMENT', 'ADJUSTMENT']);

export function isManualTransaction(row: { type: string }): boolean {
  return MANUAL_TRANSACTION_TYPES.has(row.type);
}

export function toFundTransaction(row: PrismaFundTransaction): FundTransaction {
  if (!isManualTransaction(row)) {
    throw new RangeError(
      `операция ${row.id} типа "${row.type}" выводится из своей таблицы и в ядро не передаётся`,
    );
  }

  return {
    id: row.id,
    type: row.type as ManualTransactionType,
    amount: toKopecks(row.amount, `сумма операции ${row.id}`),
    userId: row.userId,
    // У журнала нет колонки с календарным днём — только момент вставки (§11).
    occurredOn: instantToIsoDate(row.createdAt),
    comment: row.comment ?? undefined,
  };
}
