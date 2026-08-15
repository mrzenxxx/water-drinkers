import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { hasProfile, requirePageUser } from '@/lib/auth/current-user';

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

  return <AppShell user={user}>{children}</AppShell>;
}
