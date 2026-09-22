/**
 * DataLoader: батчинг и кеш на время одного запроса (§10.1, §10.3).
 *
 * Ловушка, ради которой GraphQL и берут в учебный проект: запрос
 * `contributions { user { firstName } }` на двести взносов без батчинга даёт
 * двести походов в базу. DataLoader копит ключи в пределах одного тика цикла
 * событий и вызывает батч-функцию один раз на весь список.
 *
 * Лоадеры создаются **на каждый запрос** и живут в контексте. Общий лоадер на
 * процесс был бы кешем без срока годности: подтверждённый взнос показывался бы
 * ожидающим до перезапуска сервера.
 *
 * Два правила батч-функции, которые легко нарушить:
 *  1. результат возвращается в том же порядке и той же длины, что и ключи;
 *  2. отсутствующая строка — это `null` в нужной позиции, а не пропуск.
 */

import DataLoader from 'dataloader';

import type {
  Absence as PrismaAbsence,
  Contribution as PrismaContribution,
  Department as PrismaDepartment,
  PrismaClient,
  Receipt as PrismaReceipt,
  User as PrismaUser,
  WaterOrder as PrismaWaterOrder,
} from '@/generated/prisma/client';

export type Loaders = {
  userById: DataLoader<string, PrismaUser | null>;
  departmentById: DataLoader<string, PrismaDepartment | null>;
  receiptById: DataLoader<string, PrismaReceipt | null>;
  waterOrderById: DataLoader<string, PrismaWaterOrder | null>;
  absencesByUserId: DataLoader<string, PrismaAbsence[]>;
  contributionsByUserId: DataLoader<string, PrismaContribution[]>;
};

/** Раскладывает строки по порядку запрошенных ключей; пропущенные — `null`. */
function byKey<T>(rows: readonly T[], keys: readonly string[], keyOf: (row: T) => string): (T | null)[] {
  const index = new Map(rows.map((row) => [keyOf(row), row]));
  return keys.map((key) => index.get(key) ?? null);
}

/** То же для связи «один ко многим»: у каждого ключа свой список, пусть и пустой. */
function groupByKey<T>(rows: readonly T[], keys: readonly string[], keyOf: (row: T) => string): T[][] {
  const groups = new Map<string, T[]>(keys.map((key) => [key, []]));
  for (const row of rows) {
    groups.get(keyOf(row))?.push(row);
  }
  return keys.map((key) => groups.get(key) ?? []);
}

export function createLoaders(db: PrismaClient): Loaders {
  return {
    userById: new DataLoader(async (ids) => {
      const rows = await db.user.findMany({ where: { id: { in: [...ids] } } });
      return byKey(rows, ids as readonly string[], (row) => row.id);
    }),

    departmentById: new DataLoader(async (ids) => {
      const rows = await db.department.findMany({ where: { id: { in: [...ids] } } });
      return byKey(rows, ids as readonly string[], (row) => row.id);
    }),

    receiptById: new DataLoader(async (ids) => {
      const rows = await db.receipt.findMany({ where: { id: { in: [...ids] } } });
      return byKey(rows, ids as readonly string[], (row) => row.id);
    }),

    waterOrderById: new DataLoader(async (ids) => {
      const rows = await db.waterOrder.findMany({ where: { id: { in: [...ids] } } });
      return byKey(rows, ids as readonly string[], (row) => row.id);
    }),

    absencesByUserId: new DataLoader(async (userIds) => {
      const rows = await db.absence.findMany({
        where: { userId: { in: [...userIds] } },
        orderBy: { startsOn: 'asc' },
      });
      return groupByKey(rows, userIds as readonly string[], (row) => row.userId);
    }),

    contributionsByUserId: new DataLoader(async (userIds) => {
      const rows = await db.contribution.findMany({
        where: { userId: { in: [...userIds] } },
        orderBy: { paidAt: 'desc' },
      });
      return groupByKey(rows, userIds as readonly string[], (row) => row.userId);
    }),
  };
}
