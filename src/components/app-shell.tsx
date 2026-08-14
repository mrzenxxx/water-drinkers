import Link from 'next/link';
import type { ReactNode } from 'react';

import { APP_SECTIONS, AppNav, type NavItem } from '@/components/app-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/actions/session';
import { ROLE_LABEL, fullName, type NamedUser } from '@/lib/format';

/**
 * Оболочка приложения: шапка, разделы, текущий участник, тема, выход.
 *
 * Серверный компонент: ничего интерактивного здесь нет — подсветка раздела
 * живёт в `AppNav`, переключатель темы в `ThemeToggle`, а выход это форма
 * с серверным действием. Оболочка в бандл не едет.
 */

type AppShellProps = {
  user: NamedUser & { role: string };
  children: ReactNode;
};

export function AppShell({ user, children }: AppShellProps): ReactNode {
  // Пункт «Админ-панель» видит только администратор (§3, §6.7). Скрытие —
  // удобство, а не защита: сами страницы закрыты `requirePageAdmin`.
  const sections: NavItem[] =
    user.role === 'ADMIN'
      ? [...APP_SECTIONS, { href: '/admin', label: 'Админ-панель' }]
      : [...APP_SECTIONS];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-card/80 border-border sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">WaterDrinkers</span>
              <span className="text-muted-foreground hidden text-xs sm:inline">
                касса на воду
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="hidden text-right text-sm sm:block">
                <span className="block leading-tight font-medium">{fullName(user)}</span>
                <span className="text-muted-foreground block text-xs leading-tight">
                  {ROLE_LABEL[user.role] ?? 'Участник'}
                </span>
              </span>

              <ThemeToggle />

              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Выйти
                </Button>
              </form>
            </div>
          </div>

          <AppNav items={sections} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      <footer className="text-muted-foreground border-border mx-auto w-full max-w-6xl border-t px-4 py-6 text-xs">
        Σ балансов всех участников всегда равна остатку фонда. Расхождение видно
        в разделе{' '}
        <Link href="/fund" className="underline underline-offset-2">
          «Фонд»
        </Link>
        .
      </footer>
    </div>
  );
}
