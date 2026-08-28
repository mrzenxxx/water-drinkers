import { Droplets, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AppNav } from '@/components/app-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/actions/session';
import { ROLE_LABEL, fullName, type NamedUser } from '@/lib/format';
import { APP_SECTIONS, type NavItem } from '@/lib/view/nav';

/**
 * Оболочка приложения: шапка, разделы, текущий участник, тема, выход.
 *
 * Серверный компонент: ничего интерактивного здесь нет — подсветка раздела
 * и бургер-меню живут в `AppNav`, переключатель темы в `ThemeToggle`, а выход
 * это форма с серверным действием. Оболочка в бандл не едет.
 *
 * Шапка — один flex-контейнер с переносом, а не два ряда вложенных блоков.
 * Порядок элементов задан классами `order-*`, поэтому `AppNav` умеет занять
 * сразу два места: бургер слева от логотипа, список разделов — строкой ниже.
 * На узком экране подписи уступают место значкам: имя, слово «Выйти» и
 * разделы прячутся, значки и бургер остаются.
 *
 * Шапка стеклянная и плотнее карточек (`glass-strong`): она висит над
 * содержимым, и сквозь неё не должен читаться уезжающий под неё текст.
 * Рамка остаётся только снизу — стекло здесь край экрана, а не карточка.
 */

type AppShellProps = {
  user: NamedUser & { role: string };
  /** Непрочитанные объявления (§6.12) — число на значке раздела. */
  unreadNotices?: number;
  children: ReactNode;
};

export function AppShell({ user, unreadNotices = 0, children }: AppShellProps): ReactNode {
  // Пункт «Админ-панель» видит только администратор (§3, §6.7). Скрытие —
  // удобство, а не защита: сами страницы закрыты `requirePageAdmin`.
  const withAdmin: NavItem[] =
    user.role === 'ADMIN'
      ? [...APP_SECTIONS, { href: '/admin', label: 'Админ-панель', icon: 'admin' }]
      : [...APP_SECTIONS];

  const sections: NavItem[] = withAdmin.map((item) =>
    item.href === '/notices' && unreadNotices > 0 ? { ...item, badge: unreadNotices } : item,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-strong sticky top-0 z-20 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
          <AppNav items={sections} />

          <Link
            href="/"
            className="focus-visible:ring-ring order-2 mr-auto flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            {/* Капля — знак приложения. Подпись рядом, поэтому значок декоративен. */}
            <span className="droplet-mark flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Droplets aria-hidden className="size-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-gradient-water text-lg font-semibold tracking-tight">
                WaterDrinkers
              </span>
              <span className="text-muted-foreground mt-0.5 hidden text-xs sm:inline">
                касса на воду
              </span>
            </span>
          </Link>

          <div className="order-3 flex items-center gap-1">
            {/*
              Имя и значок — одна ссылка на профиль: на узком экране подпись
              уходит, но нажимать всё равно есть куда. Подпись для чтения с
              экрана появляется ровно там, где исчезает видимая.
            */}
            <Link
              href="/profile"
              title="Профиль"
              className="hover:bg-secondary/70 focus-visible:ring-ring flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="hidden text-right text-sm sm:block">
                <span className="block leading-tight font-medium">{fullName(user)}</span>
                <span className="text-muted-foreground block text-xs leading-tight">
                  {ROLE_LABEL[user.role] ?? 'Участник'}
                </span>
              </span>
              <span className="droplet-mark flex size-8 shrink-0 items-center justify-center rounded-full">
                <UserRound aria-hidden className="size-4" />
              </span>
              <span className="sr-only sm:hidden">Профиль</span>
            </Link>

            <ThemeToggle />

            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" title="Выйти">
                <LogOut aria-hidden className="size-4" />
                <span className="hidden sm:inline">Выйти</span>
                <span className="sr-only sm:hidden">Выйти</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>

      <footer className="text-muted-foreground border-border mx-auto mt-4 flex w-full max-w-6xl items-start gap-2 border-t px-4 py-6 text-xs">
        <Droplets aria-hidden className="text-primary mt-0.5 size-4 shrink-0 opacity-70" />
        <p>
          Σ балансов всех участников всегда равна остатку фонда. Расхождение видно
          в разделе{' '}
          <Link href="/fund" className="underline underline-offset-2">
            «Фонд»
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
