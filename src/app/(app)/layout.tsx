import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { hasProfile, requirePageUser } from '@/lib/auth/current-user';
import { countUnreadAnnouncements, fundState } from '@/lib/data/queries';

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

  // Счётчик и цифры шапки считаются здесь, а не в оболочке: `AppShell`
  // получает готовые значения и остаётся тонким, а к базе за одно и то же
  // ходят из одного места. Пересчёт фонда мемоизирован `cache()`, поэтому
  // страница, которой он нужен тоже, второго запроса не делает.
  const [unreadNotices, state] = await Promise.all([
    countUnreadAnnouncements(user.announcementsSeenAt?.toISOString() ?? null),
    fundState(),
  ]);

  return (
    <AppShell
      user={user}
      unreadNotices={unreadNotices}
      balance={state.balanceOf(user.id)?.amount ?? 0}
      fundBalance={state.result.fundBalance}
    >
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
