import { Droplets, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BottomNav, MainNav } from '@/components/main-nav';
import { SectionTabs } from '@/components/nav-tabs';
import { ThemeToggle } from '@/components/theme-toggle';
import { ROLE_LABEL, fullName, type NamedUser } from '@/lib/format';
import { APP_NAME } from '@/lib/view/app';
import { APP_SECTIONS, ADMIN_SECTION, type NavSection } from '@/lib/view/nav';

/**
 * Оболочка приложения: верхняя полоса, разделы, вкладки раздела.
 *
 * Серверный компонент: ничего интерактивного здесь нет — подсветка текущего
 * раздела живёт в `MainNav`, `BottomNav` и `NavTabs`, переключатель темы в
 * `ThemeToggle`. Оболочка в бандл не едет.
 *
 * **Навигация одна.** Раньше форм было две — боковая панель и строка вкладок,
 * — и человек выбирал между ними кнопкой. Выбор стоил трёх компонентов,
 * хранилища, скрипта в `<head>` и полусотни строк CSS, а сам вопрос «каким
 * меню вы предпочитаете пользоваться» интерфейс задавать не должен. Осталась
 * одна форма: разделы в верхней полосе, а на узком экране — полосой значков у
 * нижнего края. Её три размера описаны в `main-nav.tsx`.
 *
 * **Полоса всегда в один ряд.** Второй ряд — это ровно та высота шапки, от
 * которой мы уходили: на узкой ширине подписи уходят под значки и мельчают,
 * а не переносятся.
 *
 * **Цифр в полосе больше нет.** Баланс и остаток фонда стояли здесь ради
 * ответа «должен или нет» с любого экрана, но занимали середину полосы —
 * именно то место, куда теперь встали разделы. Обе цифры встречают человека
 * на главной, крупно и с объяснением, и повторять их в каждой строке шапки
 * незачем.
 *
 * В полосе остались знак приложения слева, разделы посередине и тема с
 * участником справа. Выхода среди них нет: выйти — редкое и необратимое
 * действие, ему место в профиле, а не в одном ряду с ежедневной навигацией
 * (§6.10).
 *
 * Полоса стеклянная и плотнее карточек (`glass-strong`): она висит над
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
  // Раздел «Админ-панель» видит только администратор (§3, §6.7). Скрытие —
  // удобство, а не защита: сами страницы закрыты `requirePageAdmin`.
  const withAdmin: NavSection[] =
    user.role === 'ADMIN' ? [...APP_SECTIONS, ADMIN_SECTION] : [...APP_SECTIONS];

  const sections: NavSection[] = withAdmin.map((item) =>
    item.href === '/notices' && unreadNotices > 0 ? { ...item, badge: unreadNotices } : item,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-strong sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        {/*
          Шапка идёт во всю ширину — стекло здесь край экрана, — но её
          содержимое стоит в том же контейнере, что и содержимое страницы
          (`max-w-6xl`, тот же боковой отступ). Иначе знак приложения и
          участник висят снаружи колонки, по которой выровнено всё остальное,
          и глазу не на что опереться.
        */}
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3">
          {/*
            Название рядом с каплей уступает место разделам и возвращается
            только там, где оно им не мешает (`lg`). Повод отдать место
            именно ему: слово повторяет стоящий рядом знак, а подпись раздела
            не повторяет ничего. На телефоне разделы живут внизу, полоса
            пустая — название возвращается и там.
          */}
          <Link
            href="/"
            aria-label={`${APP_NAME}, на главную`}
            className="focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            {/* Капля — знак приложения. Подпись рядом, поэтому значок декоративен. */}
            <span className="droplet-mark flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Droplets aria-hidden className="size-5" />
            </span>
            {/*
              Подпись — только видимая: название ссылки читалке сказано
              `aria-label`, и оно не пропадает вместе со словом.
            */}
            <span
              aria-hidden
              className="text-gradient-water text-lg font-semibold tracking-tight md:hidden lg:inline"
            >
              {APP_NAME}
            </span>
          </Link>

          <MainNav items={sections} />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />

            {/*
              Имя и значок — одна ссылка на профиль: там, где подпись не
              помещается, нажимать всё равно есть куда. Имя уступает место
              разделам по той же причине, что и название приложения: значок
              рядом уже говорит «это вы». Подпись для чтения с экрана
              появляется ровно там, где исчезает видимая.
            */}
            <Link
              href="/profile"
              title="Профиль"
              className="hover:bg-secondary/70 focus-visible:ring-ring flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="hidden text-right text-sm xl:block">
                <span className="block leading-tight font-medium">{fullName(user)}</span>
                <span className="text-muted-foreground block text-xs leading-tight">
                  {ROLE_LABEL[user.role] ?? 'Участник'}
                </span>
              </span>
              <span className="droplet-mark flex size-8 shrink-0 items-center justify-center rounded-full">
                <UserRound aria-hidden className="size-4" />
              </span>
              <span className="sr-only xl:hidden">Профиль</span>
            </Link>
          </div>
        </div>
      </header>

      {/*
        Отступ снизу держит место под нижнюю полосу разделов узкого экрана:
        она отрисована `fixed` и в потоке не участвует, поэтому последняя
        строка страницы иначе ушла бы под стекло.
      */}
      <div className="nav-bottom-gutter flex flex-1 flex-col">
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

      <BottomNav items={sections} />
    </div>
  );
}
