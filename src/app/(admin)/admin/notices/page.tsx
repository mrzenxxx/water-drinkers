import type { ReactNode } from 'react';

import { AnnouncementComposer, AnnouncementEditor } from '@/components/admin/announcement-forms';
import { listAnnouncements } from '@/lib/data/queries';
import { MAX_PINNED_ANNOUNCEMENTS } from '@/lib/view/announcements';

/**
 * Объявления в админ-панели (§6.12).
 *
 * Здесь виден весь набор — включая черновики и архив, которых участник
 * не видит вовсе. Право на это проверяет оболочка раздела (`requirePageAdmin`),
 * а на стороне API — сам резолвер: `announcements(includeHidden: true)`
 * от участника отвечает отказом, а не пустым списком.
 */
export default async function AdminNoticesPage(): Promise<ReactNode> {
  const items = await listAnnouncements(true);

  const live = items.filter((item) => item.archivedAt === null);
  const archived = items.filter((item) => item.archivedAt !== null);
  const pinnedCount = live.filter((item) => item.pinned).length;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Объявления</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Сообщения всем участникам: инструкции по пользованию системой и новости про кассу.
          Денег объявление не касается — в расчёт балансов и в ленту событий оно не попадает.
        </p>
      </div>

      <AnnouncementComposer />

      {live.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">В списке участника</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Закреплено {pinnedCount} из {MAX_PINNED_ANNOUNCEMENTS}
            </p>
          </div>
          {live.map((item) => (
            <AnnouncementEditor key={item.id} item={item} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">Архив</h3>
          <p className="text-muted-foreground -mt-2 text-sm">
            Убрано с глаз, но не удалено: на эти записи ссылается журнал аудита.
          </p>
          {archived.map((item) => (
            <AnnouncementEditor key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
