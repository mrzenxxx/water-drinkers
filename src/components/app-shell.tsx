import { Droplets, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Amount, type AmountTone } from '@/components/amount';
import { AppSidebar } from '@/components/app-sidebar';
import { NavLayoutToggle } from '@/components/nav-layout-toggle';
import { NavTabs, SectionTabs } from '@/components/nav-tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { ROLE_LABEL, fullName, type NamedUser } from '@/lib/format';
import type { Kopecks } from '@/lib/money';
import { cn } from '@/lib/utils';
import { APP_SECTIONS, ADMIN_SECTION, type NavSection } from '@/lib/view/nav';

/**
 * Оболочка приложения: боковая панель, верхняя полоса, вкладки раздела.
 *
 * Серверный компонент: ничего интерактивного здесь нет — подсветка раздела,
 * сворачивание панели и выбор её формы живут в `AppSidebar`, `NavTabs` и
 * `NavLayoutToggle`, переключатель темы в `ThemeToggle`. Оболочка в бандл
 * не едет.
 *
 * Почему разделы уехали влево. В строку их было девять, и шапка вырастала в
 * два ряда: половина высоты первого экрана уходила на навигацию. Вертикальный
 * список места по высоте не занимает вовсе, а свёрнутый — ещё и по ширине.
 * Строка вкладок при этом никуда не делась: она осталась как выбор (кнопка
 * рядом с темой), а не как единственный вариант.
 *
 * Верхняя полоса — один ряд: знак приложения (когда его нет в панели), две
 * цифры, ради которых сюда заходят, и три кнопки справа. Выхода среди них
 * больше нет: выйти — редкое и необратимое действие, ему место в профиле,
 * а не в одном ряду с ежедневной навигацией (§6.10).
 *
 * Полоса стеклянная и плотнее карточек (`glass-strong`): она висит над
 * содержимым, и сквозь неё не должен читаться уезжающий под неё текст.
 * Рамка остаётся только снизу — стекло здесь край экрана, а не карточка.
 */

type AppShellProps = {
  user: NamedUser & { role: string };
  /** Непрочитанные объявления (§6.12) — число на значке раздела. */
  unreadNotices?: number;
  /** Баланс участника и остаток фонда — две цифры верхней полосы. */
  balance: Kopecks;
  fundBalance: Kopecks;
  children: ReactNode;
};

/**
 * Цифра в верхней полосе: значок, подпись, сумма.
 *
 * Подпись стоит всегда — цвет и знак числа лишь подхватывают то, что уже
 * сказано словом (§12). На узких экранах плитки уходят: там та же цифра
 * встречает человека на главной, крупно и с объяснением.
 */
function Stat({
  icon: Icon,
  label,
  value,
  tone,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: Kopecks;
  tone: AmountTone;
  className?: string;
}): ReactNode {
  return (
    <div className={cn('glass-soft flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5', className)}>
      <span className="droplet-mark flex size-7 shrink-0 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Amount
          value={value}
          tone={tone}
          signed={tone === 'auto'}
          className="mt-0.5 text-sm font-semibold"
        />
      </span>
    </div>
  );
}

export function AppShell({
  user,
  unreadNotices = 0,
  balance,
  fundBalance,
  children,
}: AppShellProps): ReactNode {
  // Раздел «Админ-панель» видит только администратор (§3, §6.7). Скрытие —
  // удобство, а не защита: сами страницы закрыты `requirePageAdmin`.
  const withAdmin: NavSection[] =
    user.role === 'ADMIN' ? [...APP_SECTIONS, ADMIN_SECTION] : [...APP_SECTIONS];

  const sections: NavSection[] = withAdmin.map((item) =>
    item.href === '/notices' && unreadNotices > 0 ? { ...item, badge: unreadNotices } : item,
  );

  return (
    <div className="sidebar-gutter flex min-h-dvh flex-col">
      <header className="glass-strong sticky top-0 z-30 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4">
          {/* Бургер и сама панель делят одно состояние, поэтому живут в одном компоненте. */}
          <AppSidebar items={sections} />

          {/*
            Знак приложения показывается там, где его нет в боковой панели:
            на узком экране и в режиме вкладок. Правило — в `globals.css`,
            чтобы режим переключался без перерисовки разметки.
          */}
          <Link
            href="/"
            className="shell-brand focus-visible:ring-ring items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="droplet-mark flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Droplets aria-hidden className="size-5" />
            </span>
            <span className="text-gradient-water text-lg font-semibold tracking-tight">
              WaterDrinkers
            </span>
          </Link>

          <Stat
            icon={Wallet}
            label="Ваш баланс"
            value={balance}
            tone="auto"
            className="hidden sm:flex"
          />
          <Stat
            icon={Droplets}
            label="В кассе"
            value={fundBalance}
            tone="neutral"
            className="hidden lg:flex"
          />

          <div className="ml-auto flex items-center gap-1">
            <NavLayoutToggle />
            <ThemeToggle />

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
          </div>
        </div>

        {/* Разделы строкой — только в режиме вкладок; показом заведует CSS. */}
        <div className="mx-auto w-full max-w-6xl px-4">
          <NavTabs items={sections} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
        <SectionTabs items={sections} />
        {children}
      </main>

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
