/**
 * Отметка «раздел объявлений просмотрен» (§6.12).
 *
 * Одна функция на два пути: её зовёт и мутация `markAnnouncementsSeen`,
 * и отрисовка страницы `/notices`. Второй реализации здесь быть не должно —
 * разойдясь, они дали бы разное число непрочитанного в шапке и в разделе.
 */

import type { DbClient } from './audit';

/**
 * Пометить всё опубликованное прочитанным. Возвращает новый момент отсчёта
 * или `null`, если объявлений нет вовсе.
 *
 * Отметка ставится по **самой свежей публикации**, а не по «сейчас». Разница
 * не косметическая: между чтением списка и записью может выйти новое
 * объявление, и `now()` погасил бы его непрочитанным, так и не показав.
 *
 * Запись идёт только вперёд: у того, кто открыл раздел, а затем зашёл в старую
 * вкладку, отметка не должна откатываться назад и воскрешать прочитанное.
 */
export async function markAnnouncementsSeen(
  db: DbClient,
  userId: string,
): Promise<Date | null> {
  const latest = await db.announcement.findFirst({
    where: { archivedAt: null, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
  });

  const publishedAt = latest?.publishedAt ?? null;
  if (publishedAt === null) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  const seenAt = user?.announcementsSeenAt ?? null;
  if (seenAt !== null && seenAt.getTime() >= publishedAt.getTime()) return seenAt;

  await db.user.update({ where: { id: userId }, data: { announcementsSeenAt: publishedAt } });
  return publishedAt;
}
