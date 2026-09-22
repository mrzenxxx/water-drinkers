import { Megaphone } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnnouncementCard } from '@/components/announcement-card';
import { PageHeader } from '@/components/page-header';
import { requirePageUser } from '@/lib/auth/current-user';
import { markAnnouncementsSeen } from '@/lib/data';
import { prisma } from '@/lib/db';
import { listAnnouncements, peopleById } from '@/lib/data/queries';
import { isUnread } from '@/lib/view/announcements';
import { pageTitle } from '@/lib/view/app';

/**
 * Объявления (§6.12).
 *
 * Сообщения администратора всем участникам: инструкции по пользованию
 * системой и новости про кассу. Событием фонда объявление не является —
 * денег не несёт, в расчёт балансов не входит и в ленту §6.9 не попадает.
 *
 * Серверный компонент читает слой данных напрямую, без HTTP к собственному
 * `/api/graphql` (§12а) и без `useEffect` на монтировании.
 */
export default async function NoticesPage(): Promise<ReactNode> {
  const user = await requirePageUser();
  const [items, byId] = await Promise.all([listAnnouncements(), peopleById()]);

  // Что считать новым, решается **до** отметки: иначе страница, которая ставит
  // отметку, сама же и погасила бы все значки «Новое» на себе.
  const seenAt = user.announcementsSeenAt?.toISOString() ?? null;
  const fresh = new Set(items.filter((item) => isUnread(item, seenAt)).map((item) => item.id));

  /**
   * Отметка ставится самой отрисовкой — единственное место в приложении, где
   * серверный компонент меняет состояние.
   *
   * Обычно за состоянием чтения ходят кнопкой «отметить прочитанным», но
   * нажимать её никто не будет, и значок непрочитанного горел бы вечно.
   * Отметка идемпотентна, денег не касается и двигается только вперёд
   * (см. `src/lib/data/announcements.ts`), поэтому побочный эффект здесь
   * безопаснее вечно горящего значка. Предзагрузка ссылки его не вызывает:
   * страницы приложения объявлены `force-dynamic` и целиком заранее
   * не отрисовываются.
   */
  await markAnnouncementsSeen(prisma, user.id);

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Объявления')}</title>

      <PageHeader icon={Megaphone} title="Объявления">
        Сообщения администратора: как пользоваться кассой и что в ней происходит.
        Закреплённые не тонут — там живут инструкции.
      </PageHeader>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Объявлений пока нет. Здесь появятся инструкции и сообщения администратора.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              author={byId.get(item.createdBy) ?? null}
              isNew={fresh.has(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
