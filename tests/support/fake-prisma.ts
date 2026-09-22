/**
 * Подставной клиент Prisma: таблицы в памяти вместо PostgreSQL.
 *
 * Живой базы на машине разработки нет (нет ни клиента psql, ни демона Docker),
 * а интеграционные проверки резолверов нужны уже сейчас: права по ролям и
 * правило «взнос влияет на баланс только после подтверждения» (правило 6
 * CLAUDE.md) — ровно то, что модульным тестом ядра не поймать.
 *
 * Подделка честная в трёх вещах, на которых держатся эти проверки:
 *  * `$transaction` откатывает **все** таблицы при исключении, поэтому
 *    «взнос подтверждён, а операция в журнал не попала» здесь не проходит;
 *  * запрет пересекающихся отсутствий (`EXCLUDE USING gist`, §11) повторён
 *    и бросает ошибку с кодом PostgreSQL `23P01`;
 *  * `CHECK (amount > 0)` на взносах и заказах тоже воспроизведён.
 *
 * Всё остальное — минимум, нужный слою данных: `where` понимает равенство,
 * `in`, `not`, `gte`/`lte`, `startsWith` и `OR`; `select` и `include`
 * не применяются — возвращается строка целиком. Незнакомую форму условия подделка не
 * пытается угадать, а бросает: тихо вернуть не те строки хуже, чем упасть.
 */

import type { PrismaClient } from '@/generated/prisma/client';

type Row = Record<string, unknown>;

export class FakePrismaError extends Error {
  readonly code: string;
  readonly meta: Record<string, unknown>;

  constructor(message: string, code: string, meta: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FakePrismaError';
    this.code = code;
    this.meta = meta;
  }
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition === null) return value === null;

  if (typeof condition === 'object' && condition !== undefined && !(condition instanceof Date)) {
    for (const [operator, operand] of Object.entries(condition as Row)) {
      switch (operator) {
        case 'in':
          if (!(operand as unknown[]).some((item) => equals(value, item))) return false;
          break;
        case 'notIn':
          if ((operand as unknown[]).some((item) => equals(value, item))) return false;
          break;
        case 'not':
          if (matchesCondition(value, operand)) return false;
          break;
        case 'gte':
          if (!(compare(value, operand) >= 0)) return false;
          break;
        case 'lte':
          if (!(compare(value, operand) <= 0)) return false;
          break;
        case 'gt':
          if (!(compare(value, operand) > 0)) return false;
          break;
        case 'lt':
          if (!(compare(value, operand) < 0)) return false;
          break;
        case 'startsWith':
          if (typeof value !== 'string' || !value.startsWith(operand as string)) return false;
          break;
        default:
          throw new Error(`fake-prisma: оператор "${operator}" не поддержан`);
      }
    }
    return true;
  }

  return equals(value, condition);
}

function equals(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function compare(a: unknown, b: unknown): number {
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (typeof left === 'bigint' || typeof right === 'bigint') {
    return BigInt(left as bigint) < BigInt(right as bigint) ? -1 : BigInt(left as bigint) > BigInt(right as bigint) ? 1 : 0;
  }
  if ((left as number) < (right as number)) return -1;
  if ((left as number) > (right as number)) return 1;
  return 0;
}

function matches(row: Row, where: Row | undefined): boolean {
  if (where === undefined) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(condition as Row[]).some((clause) => matches(row, clause))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!(condition as Row[]).every((clause) => matches(row, clause))) return false;
      continue;
    }
    if (condition === undefined) continue;
    if (!matchesCondition(row[key], condition)) return false;
  }

  return true;
}

type OrderBy = Record<string, 'asc' | 'desc'>;

function sortRows(rows: Row[], orderBy: OrderBy | OrderBy[] | undefined): Row[] {
  if (orderBy === undefined) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const sign = compare(a[field], b[field]) * (direction === 'desc' ? -1 : 1);
        if (sign !== 0) return sign;
      }
    }
    return 0;
  });
}

type Constraint = (row: Row, all: Row[]) => void;

class FakeTable {
  readonly rows: Row[] = [];

  constructor(
    private readonly name: string,
    private readonly nextId: () => unknown,
    private readonly defaults: () => Row,
    private readonly constraints: Constraint[] = [],
  ) {}

  snapshot(): Row[] {
    return this.rows.map((row) => ({ ...row }));
  }

  restore(rows: Row[]): void {
    this.rows.length = 0;
    this.rows.push(...rows.map((row) => ({ ...row })));
  }

  seed(rows: Row[]): void {
    for (const row of rows) {
      this.rows.push({ ...this.defaults(), id: this.nextId(), ...row });
    }
  }

  findMany(args: { where?: Row; orderBy?: OrderBy | OrderBy[]; take?: number } = {}): Row[] {
    const found = sortRows(this.rows.filter((row) => matches(row, args.where)), args.orderBy);
    const limited = args.take === undefined ? found : found.slice(0, args.take);
    return limited.map((row) => ({ ...row }));
  }

  findFirst(args: { where?: Row; orderBy?: OrderBy | OrderBy[] } = {}): Row | null {
    return this.findMany(args)[0] ?? null;
  }

  findUnique(args: { where: Row }): Row | null {
    return this.findFirst({ where: args.where });
  }

  findUniqueOrThrow(args: { where: Row }): Row {
    const row = this.findUnique(args);
    if (row === null) {
      throw new FakePrismaError(`${this.name}: строка не найдена`, 'P2025');
    }
    return row;
  }

  count(args: { where?: Row } = {}): number {
    return this.rows.filter((row) => matches(row, args.where)).length;
  }

  create(args: { data: Row }): Row {
    const row: Row = { ...this.defaults(), id: this.nextId(), ...args.data };
    for (const constraint of this.constraints) constraint(row, this.rows);
    this.rows.push(row);
    return { ...row };
  }

  update(args: { where: Row; data: Row }): Row {
    const index = this.rows.findIndex((row) => matches(row, args.where));
    if (index === -1) {
      throw new FakePrismaError(`${this.name}: строка для обновления не найдена`, 'P2025');
    }
    const updated = { ...this.rows[index], ...args.data };
    for (const constraint of this.constraints) {
      constraint(updated, this.rows.filter((_, position) => position !== index));
    }
    this.rows[index] = updated;
    return { ...updated };
  }

  upsert(args: { where: Row; create: Row; update: Row }): Row {
    const existing = this.rows.find((row) => matches(row, args.where));
    return existing === undefined
      ? this.create({ data: { ...args.where, ...args.create } })
      : this.update({ where: args.where, data: args.update });
  }

  delete(args: { where: Row }): Row {
    const index = this.rows.findIndex((row) => matches(row, args.where));
    if (index === -1) {
      throw new FakePrismaError(`${this.name}: строка для удаления не найдена`, 'P2025');
    }
    return { ...(this.rows.splice(index, 1)[0] as Row) };
  }

  deleteMany(args: { where?: Row } = {}): { count: number } {
    const kept = this.rows.filter((row) => !matches(row, args.where));
    const removed = this.rows.length - kept.length;
    this.rows.length = 0;
    this.rows.push(...kept);
    return { count: removed };
  }
}

/** Дата в полночь UTC — так PostgreSQL отдаёт колонку `DATE` (§11). */
export function dateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function positiveAmount(what: string): Constraint {
  return (row) => {
    if ((row.amount as bigint) <= 0n) {
      throw new FakePrismaError(`${what}: CHECK (amount > 0) нарушен`, 'P2010', { code: '23514' });
    }
  };
}

/**
 * `EXCLUDE USING gist` из §11: у одного участника отсутствия не пересекаются,
 * независимо от типа. Границы включительные с обеих сторон — `daterange(…, '[]')`.
 */
const noOverlappingAbsences: Constraint = (row, all) => {
  if ((row.endsOn as Date) < (row.startsOn as Date)) {
    throw new FakePrismaError('absences: CHECK (ends_on >= starts_on) нарушен', 'P2010', {
      code: '23514',
    });
  }
  const overlaps = all.some(
    (other) =>
      other.userId === row.userId &&
      other.id !== row.id &&
      (other.startsOn as Date) <= (row.endsOn as Date) &&
      (row.startsOn as Date) <= (other.endsOn as Date),
  );
  if (overlaps) {
    throw new FakePrismaError(
      'conflicting key value violates exclusion constraint "absences_user_id_starts_on_ends_on_excl"',
      'P2010',
      { code: '23P01' },
    );
  }
};

export type FakeDb = {
  client: PrismaClient;
  tables: Record<string, FakeTable>;
  /** Текущий момент, который подставляется в `now()`-колонки. Можно двигать. */
  now: Date;
};

let idCounter = 0;

/** Детерминированный псевдо-UUID: отладка не должна зависеть от случайности. */
function fakeUuid(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

export function createFakeDb(): FakeDb {
  const state = { now: new Date('2026-08-14T09:00:00.000Z') };
  const now = () => new Date(state.now);

  let auditId = 0;

  const tables: Record<string, FakeTable> = {
    user: new FakeTable('users', fakeUuid, () => ({
      email: null,
      firstName: null,
      middleName: null,
      lastName: null,
      passwordHash: null,
      magicLinkHash: null,
      magicLinkExpiresAt: null,
      departmentId: null,
      restriction: 'NONE',
      sessionsValidAfter: null,
      failedLogins: 0,
      lockedUntil: null,
      role: 'PARTICIPANT',
      leftAt: null,
      openingBalance: 0n,
      createdAt: now(),
      announcementsSeenAt: null,
    })),
    department: new FakeTable('departments', fakeUuid, () => ({ createdAt: now() })),
    fundSettings: new FakeTable('fund_settings', () => 1, () => ({
      id: 1,
      openingBalance: 0n,
      startDate: null,
      defaultContribution: 50_000n,
    })),
    receipt: new FakeTable('receipts', fakeUuid, () => ({
      extraction: null,
      mediaType: 'image/jpeg',
      byteSize: 0,
      createdAt: now(),
    })),
    // Ключ здесь — идентификатор чека, а не собственный: файл у чека один,
    // и своего id у него нет (§11).
    receiptFile: new FakeTable(
      'receipt_files',
      () => undefined,
      () => ({ createdAt: now() }),
    ),
    contribution: new FakeTable(
      'contributions',
      fakeUuid,
      () => ({
        status: 'PENDING',
        receiptId: null,
        submittedAt: now(),
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: null,
        historical: false,
        enteredByAdmin: false,
      }),
      [positiveAmount('contributions')],
    ),
    waterOrder: new FakeTable(
      'water_orders',
      fakeUuid,
      () => ({
        bottlesCount: null,
        supplier: null,
        note: null,
        receiptId: null,
        historical: false,
        createdAt: now(),
      }),
      [positiveAmount('water_orders')],
    ),
    absence: new FakeTable('absences', fakeUuid, () => ({ note: null, enteredByAdmin: false }), [
      noOverlappingAbsences,
    ]),
    fundTransaction: new FakeTable('fund_transactions', fakeUuid, () => ({
      userId: null,
      refId: null,
      comment: null,
      createdBy: null,
      createdAt: now(),
    })),
    announcement: new FakeTable('announcements', fakeUuid, () => ({
      pinned: false,
      publishedAt: null,
      archivedAt: null,
      createdAt: now(),
      updatedAt: now(),
      imageMediaType: null,
      imageAlt: null,
      imageWidth: null,
      imageHeight: null,
    })),
    // Ключ здесь — идентификатор объявления, а не собственный: картинка у
    // объявления одна, и своего id у неё нет (§11).
    announcementImage: new FakeTable(
      'announcement_images',
      () => undefined,
      () => ({ createdAt: now() }),
    ),
    auditEntry: new FakeTable(
      'audit_log',
      () => {
        auditId += 1;
        return BigInt(auditId);
      },
      () => ({ actorId: null, entityId: null, before: null, after: null, createdAt: now() }),
    ),
  };

  /**
   * `$transaction` со снимком всех таблиц: исключение внутри отменяет и запись
   * в журнал операций, и изменение статуса взноса. Без отката тест «взнос
   * подтверждён наполовину» проходил бы, а в PostgreSQL — нет.
   */
  async function $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    const snapshot = Object.fromEntries(
      Object.entries(tables).map(([name, table]) => [name, table.snapshot()]),
    );
    try {
      return await fn(client);
    } catch (error) {
      for (const [name, rows] of Object.entries(snapshot)) {
        (tables[name] as FakeTable).restore(rows);
      }
      throw error;
    }
  }

  const delegates = Object.fromEntries(
    Object.entries(tables).map(([name, table]) => [
      name,
      {
        findMany: async (args?: never) => table.findMany(args),
        findFirst: async (args?: never) => table.findFirst(args),
        findUnique: async (args: never) => table.findUnique(args),
        findUniqueOrThrow: async (args: never) => table.findUniqueOrThrow(args),
        count: async (args?: never) => table.count(args),
        create: async (args: never) => table.create(args),
        update: async (args: never) => table.update(args),
        upsert: async (args: never) => table.upsert(args),
        delete: async (args: never) => table.delete(args),
        deleteMany: async (args?: never) => table.deleteMany(args),
      },
    ]),
  );

  const client = { ...delegates, $transaction } as unknown as PrismaClient;

  return {
    client,
    tables,
    get now() {
      return state.now;
    },
    set now(value: Date) {
      state.now = value;
    },
  };
}
