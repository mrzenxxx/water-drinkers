import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { hasProfile, requirePageUser } from '@/lib/auth/current-user';
import { countUnreadAnnouncements } from '@/lib/data/queries';

/**
 * Закрытая часть приложения.
 *
 * Два рубежа в одном месте: гость уходит на вход, а вошедший без имени
 * и фамилии — на знакомство (§7). Проверять это на каждой странице
 * значило бы однажды забыть.
 *
 * Знакомство живёт на `/welcome`, а не на `/profile`: страница профиля лежит
 * внутри этой же группы, и переход на неё отсюда закольцевал бы редирект.
 */
/**
 * Ни одна страница приложения не может быть заранее собранной: всё, что она
 * показывает, зависит от того, кто пришёл, и от текущего состояния фонда.
 * Без явного отказа от предрендера сборка пыталась бы отрисовать эти страницы
 * без сессии и без базы — и падала бы на первом же обращении к ним.
 */
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const user = await requirePageUser();
  if (!hasProfile(user)) redirect('/welcome');

  // Счётчик непрочитанного считается здесь, а не в оболочке: `AppShell`
  // получает готовое число и остаётся тонким.
  const unreadNotices = await countUnreadAnnouncements(
    user.announcementsSeenAt?.toISOString() ?? null,
  );

  return (
    <AppShell user={user} unreadNotices={unreadNotices}>
      {user.restriction === 'MUTED' && (
        <p role="status" className="glass mb-4 rounded-xl px-4 py-3 text-sm">
          Администратор включил для вас режим только просмотра: добавлять взносы и отсутствия
          сейчас нельзя. Если это ошибка, напишите ему.
        </p>
      )}
      {children}
    </AppShell>
  );
}
