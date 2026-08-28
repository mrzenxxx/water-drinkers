import type { Prisma } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin, requireUser } from '@/graphql/context';
import { forbidden, notImplemented, requireDate } from '@/graphql/errors';
import type { QueryResolvers } from '@/graphql/generated/graphql';
import { fromIsoDate } from '@/lib/data';

/**
 * Запросы §10.2.
 *
 * Читать может любой вошедший участник: приложение прозрачно, участник видит
 * ровно то же, что администратор, разница только в праве изменять (§3).
 * Исключения — `pendingContributions` и `auditLog`: это рабочие инструменты
 * модерации, и §10.3 помечает их как ADMIN.
 *
 * Порядок сортировки задан везде явно. Без `ORDER BY` PostgreSQL волен вернуть
 * строки как угодно, и таблица на экране перетасовывалась бы между обновлениями.
 */

/** Верхняя граница выборки журнала: `limit` приходит от клиента. */
const MAX_AUDIT_LIMIT = 500;

/** Фильтр `[from, to]` по колонке DATE. Обе границы необязательны и включительны. */
function dateRangeFilter(
  from: string | null | undefined,
  to: string | null | undefined,
): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};
  if (from != null) filter.gte = fromIsoDate(requireDate(from, 'from'));
  if (to != null) filter.lte = fromIsoDate(requireDate(to, 'to'));
  return filter.gte === undefined && filter.lte === undefined ? undefined : filter;
}

export const Query: QueryResolvers<GraphQLContext> = {
  me: async (_parent, _args, ctx) => {
    if (ctx.userId === null) return null;
    return ctx.loaders.userById.load(ctx.userId);
  },

  fund: async (_parent, _args, ctx) => {
    await requireUser(ctx);
    // Настройки берутся из того же пересчёта, что и балансы: два пути к одному
    // числу разошлись бы, и `isConsistent` перестал бы что-либо доказывать.
    return (await ctx.fundState()).input.fund;
  },

  participants: async (_parent, { includeInactive }, ctx) => {
    await requireUser(ctx);
    return ctx.db.user.findMany({
      where: includeInactive ? undefined : { leftAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { email: 'asc' }],
    });
  },

  balances: async (_parent, _args, ctx) => {
    await requireUser(ctx);
    return [...(await ctx.fundState()).result.balances];
  },

  contributions: async (_parent, { userId, status, from, to }, ctx) => {
    await requireUser(ctx);

    const where: Prisma.ContributionWhereInput = {};
    if (userId != null) where.userId = userId;
    if (status != null) where.status = status;
    const paidAt = dateRangeFilter(from, to);
    if (paidAt !== undefined) where.paidAt = paidAt;

    return ctx.db.contribution.findMany({
      where,
      orderBy: [{ paidAt: 'desc' }, { submittedAt: 'desc' }],
    });
  },

  waterOrders: async (_parent, { from, to }, ctx) => {
    await requireUser(ctx);

    const where: Prisma.WaterOrderWhereInput = {};
    const orderedAt = dateRangeFilter(from, to);
    if (orderedAt !== undefined) where.orderedAt = orderedAt;

    return ctx.db.waterOrder.findMany({ where, orderBy: { orderedAt: 'desc' } });
  },

  absences: async (_parent, { from, to, type }, ctx) => {
    await requireUser(ctx);

    // Отсутствие попадает в выборку, если **пересекает** отрезок, а не лежит
    // внутри: календарь §6.6 обязан показать и отпуск, начавшийся в прошлом
    // месяце и ещё не закончившийся.
    const where: Prisma.AbsenceWhereInput = {};
    if (type != null) where.type = type;
    if (from != null) where.endsOn = { gte: fromIsoDate(requireDate(from, 'from')) };
    if (to != null) where.startsOn = { lte: fromIsoDate(requireDate(to, 'to')) };

    return ctx.db.absence.findMany({ where, orderBy: [{ startsOn: 'asc' }, { id: 'asc' }] });
  },

  pendingContributions: async (_parent, _args, ctx) => {
    await requireAdmin(ctx);
    // Старые сверху: очередь разбирается с головы, а не с хвоста.
    return ctx.db.contribution.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
    });
  },

  auditLog: async (_parent, { limit }, ctx) => {
    await requireAdmin(ctx);
    return ctx.db.auditEntry.findMany({
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(limit, 1), MAX_AUDIT_LIMIT),
    });
  },

  /**
   * Объявления (§6.12).
   *
   * Участнику видно опубликованное и не убранное в архив. `includeHidden`
   * от участника — не «молча пустой список», а отказ: молчание пряталось бы
   * от того, кто пытается подсмотреть черновики, и от того, кто просто
   * ошибся аргументом, одинаково.
   *
   * Порядок «закреплённые сверху, дальше свежие» задаётся здесь же, а не
   * оставлен базе: `ORDER BY` на двух колонках повторял бы правило экрана
   * вторым способом, и они разъехались бы на первой правке.
   */
  announcements: async (_parent, { includeHidden }, ctx) => {
    const user = await requireUser(ctx);
    if (includeHidden === true && user.role !== 'ADMIN') {
      throw forbidden('Черновики и архив объявлений видны только администратору.');
    }

    const rows = await ctx.db.announcement.findMany({
      where: includeHidden === true ? undefined : { publishedAt: { not: null }, archivedAt: null },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    });

    return rows;
  },

  /**
   * Сколько объявлений участник ещё не видел — число для значка в шапке.
   *
   * Считается запросом, а не выборкой всего списка: значок рисуется на каждой
   * странице приложения, и тащить ради него тексты всех объявлений незачем.
   */
  unreadAnnouncements: async (_parent, _args, ctx) => {
    const user = await requireUser(ctx);

    return ctx.db.announcement.count({
      where: {
        archivedAt: null,
        publishedAt:
          user.announcementsSeenAt === null ? { not: null } : { gt: user.announcementsSeenAt },
      },
    });
  },

  // Помощник — этап 7.
  assistantThread: () => notImplemented('assistantThread'),
};
