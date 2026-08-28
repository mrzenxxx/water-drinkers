/**
 * Чтение для серверных компонентов.
 *
 * Экраны берут данные отсюда напрямую, без HTTP-запроса к собственному
 * `/api/graphql` (CLAUDE.md, §12а): сеть внутри одного процесса — чистые
 * потери. HTTP-эндпоинт остаётся клиентским компонентам и внешним потребителям.
 *
 * Каждая выборка обёрнута в `cache()` из React: за один рендер страницы список
 * участников спрашивают и шапка, и таблица, и график, а запрос к базе должен
 * уйти один. Пересчёт балансов мемоизирован там же — в `getFundState`.
 *
 * Балансы здесь не считаются заново ни при каких обстоятельствах: единственная
 * точка пересчёта — `fund.ts`. Два пути к балансу дали бы два разных ответа
 * на один вопрос, и инвариант §5 перестал бы что-либо доказывать.
 */

import { cache } from 'react';

import type { Prisma } from '@/generated/prisma/client';
import { compareDates } from '@/lib/calc';
import type { ContributionStatus, IsoDate } from '@/lib/calc/types';
import { prisma } from '@/lib/db';
import type { EventSource } from '@/lib/view/events';
import { isVisible, sortAnnouncements, type AnnouncementView } from '@/lib/view/announcements';

import { fromIsoDate, instantToIsoDate, toIsoDate, todayIso } from './dates';
import { getFundState, type FundState } from './fund';
import { toKopecks } from './money';

/** Пересчёт для текущего запроса. Один на весь рендер страницы. */
export const fundState = cache(async (): Promise<FundState> => getFundState(prisma));

/** Участник с именем — то, что нужно любому списку на экране. */
export type PersonRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  joinedAt: IsoDate;
  leftAt: IsoDate | null;
};

const PERSON_ORDER: Prisma.UserOrderByWithRelationInput[] = [
  { lastName: 'asc' },
  { firstName: 'asc' },
  { email: 'asc' },
];

/**
 * Все участники, включая вышедших из состава.
 *
 * Вышедшие нужны почти везде: их взносы и доли в прошлых заказах остаются
 * в истории (§6.7), и без их имён таблица показывала бы «неизвестно кто».
 * Фильтрация «только активные» делается на месте, а не запросом.
 */
export const listPeople = cache(async (): Promise<PersonRow[]> => {
  const rows = await prisma.user.findMany({ orderBy: PERSON_ORDER });

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    joinedAt: toIsoDate(row.joinedAt),
    leftAt: row.leftAt === null ? null : toIsoDate(row.leftAt),
  }));
});

/** Участники по id — чтобы не искать линейным перебором в каждой строке таблицы. */
export const peopleById = cache(async (): Promise<Map<string, PersonRow>> => {
  const people = await listPeople();
  return new Map(people.map((person) => [person.id, person]));
});

export type ContributionRow = {
  id: string;
  userId: string;
  amount: number;
  paidAt: IsoDate;
  status: ContributionStatus;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  receiptId: string | null;
};

export type ContributionFilter = {
  userId?: string;
  status?: ContributionStatus;
  from?: IsoDate;
  to?: IsoDate;
};

/** Взносы с фильтрами §6.3. Свежие сверху — таблица читается с головы. */
export const listContributions = cache(
  async (filter: ContributionFilter = {}): Promise<ContributionRow[]> => {
    const where: Prisma.ContributionWhereInput = {};
    if (filter.userId !== undefined) where.userId = filter.userId;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.from !== undefined || filter.to !== undefined) {
      where.paidAt = {
        ...(filter.from !== undefined ? { gte: fromIsoDate(filter.from) } : {}),
        ...(filter.to !== undefined ? { lte: fromIsoDate(filter.to) } : {}),
      };
    }

    const rows = await prisma.contribution.findMany({
      where,
      orderBy: [{ paidAt: 'desc' }, { submittedAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      amount: toKopecks(row.amount, `сумма взноса ${row.id}`),
      paidAt: toIsoDate(row.paidAt),
      status: row.status as ContributionStatus,
      submittedAt: row.submittedAt.toISOString(),
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt === null ? null : row.reviewedAt.toISOString(),
      reviewComment: row.reviewComment,
      receiptId: row.receiptId,
    }));
  },
);

export type OrderRow = {
  id: string;
  amount: number;
  orderedAt: IsoDate;
  bottlesCount: number | null;
  supplier: string | null;
  note: string | null;
  createdBy: string;
  receiptId: string | null;
};

/** История заказов §6.5, свежие сверху. */
export const listOrders = cache(async (): Promise<OrderRow[]> => {
  const rows = await prisma.waterOrder.findMany({ orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }] });

  return rows.map((row) => ({
    id: row.id,
    amount: toKopecks(row.amount, `сумма заказа ${row.id}`),
    orderedAt: toIsoDate(row.orderedAt),
    bottlesCount: row.bottlesCount,
    supplier: row.supplier,
    note: row.note,
    createdBy: row.createdBy,
    receiptId: row.receiptId,
  }));
});

export type AbsenceRow = {
  id: string;
  userId: string;
  type: 'VACATION' | 'SICK_LEAVE';
  startsOn: IsoDate;
  endsOn: IsoDate;
  note: string | null;
};

/**
 * Отсутствия, **пересекающие** отрезок.
 *
 * Именно пересекающие, а не лежащие внутри: отпуск, начавшийся в прошлом
 * месяце и ещё не кончившийся, обязан быть виден в календаре (§6.6).
 */
export const listAbsences = cache(
  async (from?: IsoDate, to?: IsoDate): Promise<AbsenceRow[]> => {
    const where: Prisma.AbsenceWhereInput = {};
    if (from !== undefined) where.endsOn = { gte: fromIsoDate(from) };
    if (to !== undefined) where.startsOn = { lte: fromIsoDate(to) };

    const rows = await prisma.absence.findMany({
      where,
      orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type as 'VACATION' | 'SICK_LEAVE',
      startsOn: toIsoDate(row.startsOn),
      endsOn: toIsoDate(row.endsOn),
      note: row.note,
    }));
  },
);

export type ManualTransactionRow = {
  id: string;
  type: 'SETTLEMENT' | 'ADJUSTMENT';
  amount: number;
  userId: string | null;
  occurredOn: IsoDate;
  comment: string | null;
};

/**
 * Выплаты и корректировки из журнала операций.
 *
 * `OPENING`, `CONTRIBUTION` и `ORDER` сюда не берутся: они выводятся из своих
 * таблиц, и показать их ещё и отсюда значило бы удвоить каждое событие ленты.
 */
export const listManualTransactions = cache(async (): Promise<ManualTransactionRow[]> => {
  const rows = await prisma.fundTransaction.findMany({
    where: { type: { in: ['SETTLEMENT', 'ADJUSTMENT'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as 'SETTLEMENT' | 'ADJUSTMENT',
    amount: toKopecks(row.amount, `сумма операции ${row.id}`),
    userId: row.userId,
    // У журнала нет колонки календарного дня — только момент вставки (§11).
    occurredOn: instantToIsoDate(row.createdAt),
    comment: row.comment,
  }));
});

/** Всё, из чего строится лента событий дашборда (§6.9). */
export const timelineSource = cache(async (): Promise<EventSource> => {
  const [contributions, orders, absences, transactions] = await Promise.all([
    listContributions(),
    listOrders(),
    listAbsences(),
    listManualTransactions(),
  ]);

  return { contributions, orders, absences, transactions };
});

/**
 * Самая ранняя дата, о которой приложение знает.
 *
 * Нужна периоду «всё время» (§6.9). Дата начала учёта важнее событий: до неё
 * история свёрнута в начальные сальдо (§4.2), и период обязан начинаться там.
 */
export const earliestKnownDate = cache(async (): Promise<IsoDate> => {
  const [state, source] = await Promise.all([fundState(), timelineSource()]);

  const candidates: IsoDate[] = [];
  if (state.input.fund.startDate !== null) candidates.push(state.input.fund.startDate);
  for (const row of source.contributions) candidates.push(row.paidAt);
  for (const row of source.orders) candidates.push(row.orderedAt);
  for (const row of source.absences) candidates.push(row.startsOn);
  for (const row of source.transactions) candidates.push(row.occurredOn);
  for (const person of await listPeople()) candidates.push(person.joinedAt);

  const earliest = candidates.sort(compareDates)[0];
  return earliest ?? todayIso();
});

/**
 * Объявления администратора (§6.12).
 *
 * `includeHidden` — булев параметр, а не объект с настройками: `cache()`
 * из React сравнивает аргументы по ссылке, и объект, собранный на месте
 * вызова, промахивался бы мимо кеша при каждом обращении.
 *
 * Порядок задаёт чистая функция `sortAnnouncements`, а не `ORDER BY`:
 * «закреплённые сверху, дальше свежие» — правило экрана, и проверяется
 * оно тестом без базы.
 */
export const listAnnouncements = cache(
  async (includeHidden = false): Promise<AnnouncementView[]> => {
    const rows = await prisma.announcement.findMany();

    const items: AnnouncementView[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      pinned: row.pinned,
      publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
      archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy,
    }));

    return sortAnnouncements(includeHidden ? items : items.filter(isVisible));
  },
);

/**
 * Сколько объявлений участник ещё не видел — число для значка в шапке (§6.12).
 *
 * Считается запросом, а не выборкой всего списка: значок рисуется на **каждой**
 * странице приложения, и тащить ради одного числа тексты всех объявлений
 * незачем. Аргумент — строка, а не объект участника: `cache()` сравнивает
 * аргументы по ссылке, и объект промахивался бы мимо кеша каждый раз.
 */
export const countUnreadAnnouncements = cache(async (seenAt: string | null): Promise<number> => {
  return prisma.announcement.count({
    where: {
      archivedAt: null,
      publishedAt: seenAt === null ? { not: null } : { gt: new Date(seenAt) },
    },
  });
});
