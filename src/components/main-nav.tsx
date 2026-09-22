'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { NAV_ICONS } from '@/components/nav-icons';
import { cn } from '@/lib/utils';
import { isSectionActive, navHrefs, sectionHrefs, type NavSection } from '@/lib/view/nav';

/**
 * Разделы приложения. Одна форма навигации, а не выбор из нескольких.
 *
 * Раньше формы было две — боковая панель и строка вкладок, — и человек
 * переключал их кнопкой. Выбор стоил трёх компонентов, хранилища, скрипта в
 * `<head>` и полусотни строк CSS, а отвечал на вопрос, которого никто не
 * задавал. Здесь остался один ответ: разделы живут в верхней полосе на широком
 * экране и прижаты к нижнему краю на узком.
 *
 * Две формы одного и того же списка, и переключает их ширина экрана, а не
 * человек:
 *
 * - **`< md`** — полоса значков у нижнего края (`BottomNav`). Большой палец
 *   достаёт до неё не тянясь, чего не скажешь о верхнем крае телефона.
 *   Подписей там нет: шесть подписей в строку шириной в телефон нечитаемы, а
 *   перенос на второй ряд съел бы экран. Смысл сказан `title` и для чтения
 *   с экрана.
 * - **`md` и шире** — строка «значок и подпись» в верхней полосе, посередине
 *   между знаком приложения и участником.
 *
 * Подпись под значком мы пробовали и отказались: место под строку находится
 * и без этого, если убрать из полосы название приложения и имя участника —
 * и то и другое повторяет соседний значок, а разделы не повторяют ничего.
 * Поэтому уступают они, а не подписи разделов (`app-shell.tsx`).
 *
 * Если разделов однажды станет больше, чем влезает строкой, полоса уедет по
 * горизонтали, а не перенесётся на второй ряд: второй ряд — это ровно та
 * высота шапки, от которой мы уходили.
 */

/** Счётчик непрочитанного углом значка: место одно на все три размера. */
function Badge({ count }: { count: number }): ReactNode {
  if (count <= 0) return null;

  return (
    <>
      <span
        aria-hidden
        className="bg-primary text-primary-foreground ring-card absolute -top-1.5 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums ring-2"
      >
        {count}
      </span>
      {/*
        «Объявления 3» звучит как порядковый номер раздела, поэтому читалке
        смысл говорится словами, а цифра рядом от неё скрыта.
      */}
      <span className="sr-only">, непрочитанных: {count}</span>
    </>
  );
}

function useActive(items: readonly NavSection[]): (item: NavSection) => boolean {
  const pathname = usePathname();
  const hrefs = navHrefs(items);
  return (item) => sectionHrefs(item).some((href) => isSectionActive(pathname, href, hrefs));
}

/**
 * Разделы в верхней полосе (`md` и шире).
 *
 * Текущий раздел отмечен заливкой-стеклом, а не одним лишь цветом: цвет в
 * одиночку ничего не сообщает (§12), и `aria-current` говорит то же самое
 * читалке.
 */
export function MainNav({ items }: { items: readonly NavSection[] }): ReactNode {
  const isActive = useActive(items);

  return (
    <nav
      aria-label="Разделы приложения"
      className="hidden min-w-0 flex-1 overflow-x-auto md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* `mx-auto` держит разделы посередине, пока они помещаются. */}
      <ul className="mx-auto flex w-max items-center gap-0.5">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActive(item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={item.hint ?? item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm whitespace-nowrap transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none lg:gap-2 lg:px-3',
                  active
                    ? 'glass-soft nav-pill text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-secondary-foreground',
                )}
              >
                {/* Значок повторяет подпись, стоящую рядом, — и потому декоративен. */}
                <span className="relative flex shrink-0 items-center justify-center">
                  <Icon aria-hidden className="size-4" />
                  <Badge count={item.badge ?? 0} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Разделы у нижнего края экрана (`< md`).
 *
 * Панель закреплена (`fixed`) и не уезжает при прокрутке: переход в другой
 * раздел не должен требовать сначала пролистать страницу до конца. Место под
 * неё держит отступ `.nav-bottom-gutter` на содержимом — иначе последняя
 * строка страницы оказалась бы под стеклом.
 *
 * Нижний отступ учитывает `safe-area-inset-bottom`: на телефонах с жестовой
 * полосой без него значки упираются в неё.
 */
export function BottomNav({ items }: { items: readonly NavSection[] }): ReactNode {
  const isActive = useActive(items);

  return (
    <nav
      aria-label="Разделы приложения"
      className="glass-strong nav-bottom fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0 md:hidden"
    >
      <ul className="flex items-stretch justify-around gap-0.5 px-1 py-1.5">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActive(item);

          return (
            <li key={item.href} className="flex min-w-0 flex-1 justify-center">
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex size-11 items-center justify-center rounded-xl transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none',
                  active
                    ? 'glass-soft nav-pill text-foreground'
                    : 'text-muted-foreground active:bg-secondary/70',
                )}
              >
                <span className="relative flex items-center justify-center">
                  <Icon aria-hidden className="size-5" />
                  <Badge count={item.badge ?? 0} />
                </span>
                {/*
                  Подписи на этой ширине нет: шесть слов в строку шириной в
                  телефон нечитаемы. Название раздела остаётся подсказкой при
                  удержании и текстом для чтения с экрана — ничего не пропало,
                  кроме места.
                */}
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
