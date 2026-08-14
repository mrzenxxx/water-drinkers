/**
 * Данные админ-панели (§6.7) для серверных компонентов.
 *
 * Экраны читают отсюда напрямую, без HTTP-запроса к собственному `/api/graphql`
 * (CLAUDE.md, §12а): сеть внутри одного процесса — чистые потери. Балансы берутся
 * из той же единственной точки пересчёта, что и у резолверов (`getFundState`),
 * поэтому таблица участников и экран «Фонд» не могут разойтись в числах.
 *
 * Всё, что можно посчитать без базы, вынесено в чистые функции: очередь
 * подтверждений сортируется, журнал фильтруется и подписывается формулами,
 * которые проверяются тестами без всякого PostgreSQL.
 */

import type {
  AuditEntry as PrismaAuditEntry,
  Contribution as PrismaContribution,
  PrismaClient,
  Receipt as PrismaReceipt,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { parseExtraction, type StoredExtraction } from '@/graphql/resolvers/receipt';
import type { IsoDate } from '@/lib/calc/types';
import { formatKopecks, type Kopecks } from '@/lib/money';

import { auditActionLabel, type AuditAction } from './audit';
import { instantToIsoDate, toIsoDate, toIsoDateOrNull, toIsoDateTime, fromIsoDate } from './dates';
import { getFundState } from './fund';
import { toKopecks } from './money';

// ─── Участники ─────────────────────────────────────────────────────────────

export type ParticipantRow = {
  id: string;
  email: string;
  /** Имя и фамилия, если человек их уже ввёл; иначе адрес почты (§6.7, §7). */
  name: string;
  hasProfile: boolean;
  role: 'PARTICIPANT' | 'ADMIN';
  joinedAt: IsoDate;
  leftAt: IsoDate | null;
  isActive: boolean;
  openingBalance: Kopecks;
  balance: Kopecks;
  owes: boolean;
};

/**
 * Как называть человека на экране.
 *
 * Имя и фамилию приложение не выдумывает (§6.7): пока участник не вошёл и не
 * заполнил профиль, его зовут его же адресом — это честнее прочерка.
 */
export function participantName(user: Pick<PrismaUser, 'firstName' | 'lastName' | 'email'>): string {
  const parts = [user.lastName, user.firstName].filter((part): part is string => (part ?? '').length > 0);
  return parts.length > 0 ? parts.join(' ') : user.email;
}

export function hasProfile(user: Pick<PrismaUser, 'firstName' | 'lastName'>): boolean {
  return (user.firstName ?? '').length > 0 && (user.lastName ?? '').length > 0;
}

/** Состав с балансами: таблица вкладки «Участники». */
export async function loadParticipants(db: PrismaClient): Promise<ParticipantRow[]> {
  const [users, state] = await Promise.all([
    db.user.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { email: 'asc' }] }),
    getFundState(db),
  ]);

  return users.map((user) => {
    const balance = state.balanceOf(user.id);
    return {
      id: user.id,
      email: user.email,
      name: participantName(user),
      hasProfile: hasProfile(user),
      role: user.role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT',
      joinedAt: toIsoDate(user.joinedAt),
      leftAt: toIsoDateOrNull(user.leftAt),
      isActive: user.leftAt === null,
      openingBalance: toKopecks(user.openingBalance, `начальное сальдо ${user.id}`),
      balance: balance?.amount ?? 0,
      owes: balance?.owes ?? false,
    };
  });
}

// ─── Стартовое состояние фонда (§4.2) ──────────────────────────────────────

export type FundOverview = {
  openingBalance: Kopecks;
  startDate: IsoDate | null;
  balance: Kopecks;
  balancesSum: Kopecks;
  isConsistent: boolean;
  difference: Kopecks;
};

export async function loadFundOverview(db: PrismaClient): Promise<FundOverview> {
  const state = await getFundState(db);
  return {
    openingBalance: state.input.fund.openingBalance,
    startDate: state.input.fund.startDate,
    balance: state.invariant.fundBalance,
    balancesSum: state.invariant.balancesSum,
    isConsistent: state.invariant.isConsistent,
    difference: state.invariant.difference,
  };
}

// ─── Очередь подтверждений ─────────────────────────────────────────────────

export type QueueMismatch = {
  amount: boolean;
  paidAt: boolean;
  lowConfidence: boolean;
};

export type QueueItem = {
  id: string;
  userId: string;
  userName: string;
  amount: Kopecks;
  paidAt: IsoDate;
  submittedAt: string;
  enteredByAdmin: boolean;
  receiptUrl: string | null;
  extraction: StoredExtraction | null;
  mismatch: QueueMismatch;
  /** Низкая уверенность или расхождение с чеком (§8.3, §6.7). */
  needsAttention: boolean;
};

/**
 * Сравнение введённых значений с распознанными (§6.7).
 *
 * Взнос без чека или с нечитаемым извлечением расхождений не имеет: сравнивать
 * не с чем, а метка «требует внимания» на половине очереди перестала бы что-либо
 * значить. Распознавание — этап 6; пока `extraction` почти всегда `null`, и это
 * честное «данных нет», а не выдуманные цифры.
 */
export function compareWithReceipt(
  contribution: { amount: Kopecks; paidAt: IsoDate },
  extraction: StoredExtraction | null,
): QueueMismatch {
  if (extraction === null) {
    return { amount: false, paidAt: false, lowConfidence: false };
  }

  return {
    amount: extraction.amountKopecks !== null && extraction.amountKopecks !== contribution.amount,
    paidAt: extraction.paidAt !== null && extraction.paidAt !== contribution.paidAt,
    lowConfidence: extraction.confidence === 'LOW',
  };
}

export function needsAttention(mismatch: QueueMismatch): boolean {
  return mismatch.amount || mismatch.paidAt || mismatch.lowConfidence;
}

/**
 * Порядок очереди: сначала то, что требует внимания, затем самое старое (§6.7).
 *
 * Сортировка устойчива по `id`, иначе две записи одной секунды перетасовывались
 * бы между обновлениями страницы.
 */
export function sortQueue(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    if (a.submittedAt !== b.submittedAt) return a.submittedAt < b.submittedAt ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function toQueueItem(
  contribution: PrismaContribution,
  user: PrismaUser | undefined,
  receipt: PrismaReceipt | undefined,
): QueueItem {
  const amount = toKopecks(contribution.amount, `сумма взноса ${contribution.id}`);
  const paidAt = toIsoDate(contribution.paidAt);
  const extraction = receipt === undefined ? null : parseExtraction(receipt.extraction);
  const mismatch = compareWithReceipt({ amount, paidAt }, extraction);

  return {
    id: contribution.id,
    userId: contribution.userId,
    userName: user === undefined ? contribution.userId : participantName(user),
    amount,
    paidAt,
    submittedAt: toIsoDateTime(contribution.submittedAt),
    enteredByAdmin: contribution.enteredByAdmin,
    receiptUrl: receipt === undefined ? null : `/api/receipts/${receipt.id}`,
    extraction,
    mismatch,
    needsAttention: needsAttention(mismatch),
  };
}

/** Взносы в статусе `PENDING` вместе с чеками и распознаванием. */
export async function loadQueue(db: PrismaClient): Promise<QueueItem[]> {
  const contributions = await db.contribution.findMany({
    where: { status: 'PENDING' },
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
  });
  if (contributions.length === 0) return [];

  const userIds = [...new Set(contributions.map((row) => row.userId))];
  const receiptIds = contributions
    .map((row) => row.receiptId)
    .filter((id): id is string => id !== null);

  const [users, receipts] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } } }),
    receiptIds.length === 0
      ? Promise.resolve([] as PrismaReceipt[])
      : db.receipt.findMany({ where: { id: { in: receiptIds } } }),
  ]);

  const usersById = new Map(users.map((user) => [user.id, user]));
  const receiptsById = new Map(receipts.map((receipt) => [receipt.id, receipt]));

  return sortQueue(
    contributions.map((contribution) =>
      toQueueItem(
        contribution,
        usersById.get(contribution.userId),
        contribution.receiptId === null ? undefined : receiptsById.get(contribution.receiptId),
      ),
    ),
  );
}

// ─── Журнал аудита ─────────────────────────────────────────────────────────

export type AuditRow = {
  id: string;
  createdAt: string;
  createdOn: IsoDate;
  action: string;
  actionLabel: string;
  actorName: string | null;
  entity: string;
  entityId: string | null;
  /** Кого касается запись, если это выводится из её содержимого. */
  subjectId: string | null;
  subjectName: string | null;
  /** Короткая расшифровка `before`/`after` для колонки «Что изменилось». */
  summary: string;
};

export type AuditFilter = {
  /** Все записи, где участник — либо действующее лицо, либо предмет действия. */
  userId?: string | null;
  action?: string | null;
  from?: IsoDate | null;
  to?: IsoDate | null;
  limit?: number;
};

/** Верхняя граница выборки: журнал офисной кассы столько строк не наберёт. */
export const MAX_AUDIT_ROWS = 500;

function jsonField(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

/** Участник, которого касается запись: предмет действия или адресат операции. */
export function subjectOf(entry: Pick<PrismaAuditEntry, 'entity' | 'entityId' | 'before' | 'after'>): string | null {
  if (entry.entity === 'user' && entry.entityId !== null) return entry.entityId;

  for (const source of [entry.after, entry.before]) {
    const userId = jsonField(source, 'userId');
    if (typeof userId === 'string') return userId;
  }
  return null;
}

/**
 * Фильтр «по участнику» из §6.7.
 *
 * Совпадением считается и действие участника, и действие над ним: администратор,
 * подтвердивший чужой взнос, и автор этого взноса должны находиться по одному
 * и тому же фильтру, иначе он отвечает на вопрос, которого никто не задавал.
 */
export function concernsParticipant(
  entry: Pick<PrismaAuditEntry, 'actorId' | 'entity' | 'entityId' | 'before' | 'after'>,
  userId: string,
): boolean {
  return entry.actorId === userId || subjectOf(entry) === userId;
}

const MONEY_KEYS = new Set(['amount', 'openingBalance', 'balanceBefore', 'fundOpeningBalance']);

const VALUE_LABELS: Record<string, string> = {
  PENDING: 'на рассмотрении',
  CONFIRMED: 'подтверждён',
  REJECTED: 'отклонён',
  ADMIN: 'администратор',
  PARTICIPANT: 'участник',
  VACATION: 'отпуск',
  SICK_LEAVE: 'больничный',
  'equal-split': 'поровну',
  manual: 'вручную',
};

const KEY_LABELS: Record<string, string> = {
  amount: 'сумма',
  openingBalance: 'начальное сальдо',
  fundOpeningBalance: 'начальное сальдо фонда',
  balanceBefore: 'остаток до операции',
  paidAt: 'дата платежа',
  startDate: 'дата начала учёта',
  startsOn: 'с',
  endsOn: 'по',
  joinedAt: 'вступил',
  leftAt: 'вышел',
  status: 'статус',
  role: 'роль',
  email: 'почта',
  comment: 'комментарий',
  reviewComment: 'комментарий',
  type: 'тип',
  mode: 'способ',
  enteredByAdmin: 'внесено администратором',
};

function formatValue(key: string, value: unknown): string | null {
  if (value === null) return '—';
  if (typeof value === 'number') return MONEY_KEYS.has(key) ? formatKopecks(value) : String(value);
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (typeof value === 'string') return VALUE_LABELS[value] ?? value;
  return null;
}

/**
 * Человекочитаемая выжимка из `before`/`after`.
 *
 * Журнал §6.7 читают люди, поэтому дамп JSON здесь не годится. Незнакомые ключи
 * молча пропускаются: показать половину понятного лучше, чем всё непонятное.
 */
export function summarize(before: unknown, after: unknown): string {
  const parts: string[] = [];

  for (const [key, label] of Object.entries(KEY_LABELS)) {
    const next = jsonField(after, key);
    const previous = jsonField(before, key);
    if (next === undefined && previous === undefined) continue;

    const nextText = next === undefined ? null : formatValue(key, next);
    const previousText = previous === undefined ? null : formatValue(key, previous);

    if (nextText !== null && previousText !== null && nextText !== previousText) {
      parts.push(`${label}: ${previousText} → ${nextText}`);
    } else if (nextText !== null) {
      parts.push(`${label}: ${nextText}`);
    } else if (previousText !== null) {
      parts.push(`${label}: ${previousText}`);
    }
  }

  return parts.join(', ');
}

/**
 * Журнал с фильтрами §6.7.
 *
 * По типу действия и датам фильтрует база, по участнику — память: совпадение
 * ищется и в `actor_id`, и в теле записи, а выразить это условием Prisma по
 * JSONB значило бы завязаться на форму хранения. Строк здесь тысячи, не
 * миллионы: выборка ограничена `MAX_AUDIT_ROWS`.
 */
export async function loadAuditLog(
  db: PrismaClient,
  filter: AuditFilter = {},
): Promise<AuditRow[]> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), MAX_AUDIT_ROWS);

  const where: {
    action?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};
  if (filter.action != null && filter.action !== '') where.action = filter.action;
  if (filter.from != null) where.createdAt = { ...where.createdAt, gte: fromIsoDate(filter.from) };
  if (filter.to != null) {
    // Верхняя граница включительна: «по 14.08» обязано показать и 14 августа.
    const next = new Date(fromIsoDate(filter.to));
    next.setUTCDate(next.getUTCDate() + 1);
    where.createdAt = { ...where.createdAt, lte: next };
  }

  const rows = await db.auditEntry.findMany({
    where,
    orderBy: { id: 'desc' },
    take: MAX_AUDIT_ROWS,
  });

  const matching =
    filter.userId == null || filter.userId === ''
      ? rows
      : rows.filter((row) => concernsParticipant(row, filter.userId as string));

  const limited = matching.slice(0, limit);

  const ids = new Set<string>();
  for (const row of limited) {
    if (row.actorId !== null) ids.add(row.actorId);
    const subject = subjectOf(row);
    if (subject !== null) ids.add(subject);
  }

  const users =
    ids.size === 0
      ? []
      : await db.user.findMany({ where: { id: { in: [...ids] } } });
  const names = new Map(users.map((user) => [user.id, participantName(user)]));

  return limited.map((row) => {
    const subjectId = subjectOf(row);
    return {
      id: String(row.id),
      createdAt: toIsoDateTime(row.createdAt),
      createdOn: instantToIsoDate(row.createdAt),
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      actorName: row.actorId === null ? null : names.get(row.actorId) ?? row.actorId,
      entity: row.entity,
      entityId: row.entityId,
      subjectId,
      subjectName: subjectId === null ? null : names.get(subjectId) ?? subjectId,
      summary: summarize(row.before, row.after),
    };
  });
}

/** Действия, встречающиеся в журнале, — для выпадающего фильтра. */
export type AuditActionOption = { value: AuditAction | string; label: string };
