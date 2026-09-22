import type { User as PrismaUser } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { graphqlError } from '@/graphql/errors';
import { WRITE_RATE_LOOKBACK_MS, checkWriteRate } from '@/lib/rate-limit';

/**
 * Лимит на записи участника (§6.13): не больше одной в час и двух за сутки
 * отдельно для отсутствий и для взносов.
 *
 * Прошлые записи берутся из журнала аудита, а не из самих таблиц: у отсутствий
 * нет момента создания, а удалённое отсутствие не должно возвращать лимит —
 * иначе «добавить и удалить» обходило бы его. Записи, внесённые
 * администратором за участника, пишутся от имени администратора
 * (`*.for`) и сюда не попадают. На администратора лимит не действует.
 */
export async function requireWriteQuota(
  ctx: GraphQLContext,
  user: PrismaUser,
  action: 'absence.add' | 'contribution.submit',
  now: Date = new Date(),
): Promise<void> {
  if (user.role === 'ADMIN') return;

  const recent = await ctx.db.auditEntry.findMany({
    where: { actorId: user.id, action, createdAt: { gt: new Date(now.getTime() - WRITE_RATE_LOOKBACK_MS) } },
    select: { createdAt: true },
  });

  const decision = checkWriteRate(
    recent.map((row) => row.createdAt),
    now,
  );
  if (decision.ok) return;

  // Время — по Москве: офис в Петербурге, а сервер может жить в UTC.
  const at = decision.retryAt.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const what = action === 'absence.add' ? 'отсутствие' : 'взнос';

  throw graphqlError(
    `Слишком часто: не больше одной записи в час и двух в сутки. Следующий ${what} можно добавить ${at}.`,
    'RATE_LIMITED',
    { retryAt: decision.retryAt.toISOString() },
  );
}
