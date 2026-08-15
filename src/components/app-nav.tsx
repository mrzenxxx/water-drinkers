'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { isSectionActive, type NavItem } from '@/lib/view/nav';

/**
 * Разделы приложения: строкой на широком экране, бургер-меню на узком.
 *
 * Клиентский компонент — из-за `usePathname` (подсветка текущего раздела)
 * и состояния меню. Данных сюда не приходит, в бандл едет только список ссылок.
 *
 * Сам список разделов лежит в `@/lib/view/nav` и отсюда **не** реэкспортируется:
 * значение, вывезенное через клиентскую границу, приезжает на сервер ссылкой на
 * клиентскую сущность, а не массивом (см. комментарий в том файле).
 *
 * Обе раскладки живут в одном компоненте, потому что делят одно состояние
 * «меню открыто». Раскладываются они по местам порядком во flex-контейнере
 * шапки (`order-*`), а не вложенностью: бургер обязан стоять слева от логотипа,
 * а список — под ним, и одной обёрткой оба места не занять.
 */

const MENU_ID = 'app-sections-menu';

export function AppNav({ items }: { items: readonly NavItem[] }): ReactNode {
  const pathname = usePathname();
  const hrefs = items.map((item) => item.href);

  /**
   * Меню помнит адрес, на котором его открыли. Ушли в другой раздел — адрес
   * сменился, и меню закрыто само собой: ни `useEffect`, ни подписки на
   * маршрутизатор, ни второго источника правды (CLAUDE.md, React 19).
   * Переход в тот же раздел адрес не меняет, поэтому ссылки закрывают меню
   * ещё и по нажатию.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  const close = (): void => setOpenedAt(null);

  function linkClass(active: boolean, block: boolean): string {
    return cn(
      'focus-visible:ring-ring inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
      block && 'w-full',
      active
        ? // Подчёркивание рядом с заливкой: текущий раздел виден и без цвета (§12).
          'bg-secondary text-secondary-foreground font-medium underline underline-offset-4'
        : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={open ? 'Закрыть меню разделов' : 'Разделы'}
        className="text-muted-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-ring order-1 -ml-1 inline-flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>

      {/* Широкий экран: разделы строкой под логотипом. */}
      <nav aria-label="Разделы" className="order-4 hidden w-full md:block">
        <ul className="flex flex-wrap items-center gap-1">
          {items.map((item) => {
            const active = isSectionActive(pathname, item.href, hrefs);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass(active, false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        Узкий экран: тот же список столбиком. Спрятанный класс `hidden`, а не
        снятие с отрисовки, — тогда `aria-controls` бургера всегда указывает на
        существующий элемент, а `display: none` убирает ссылки и с экрана,
        и из порядка обхода клавиатурой.
      */}
      <nav
        id={MENU_ID}
        aria-label="Разделы"
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        className={cn('order-5 w-full pb-1 md:hidden', open ? 'block' : 'hidden')}
      >
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isSectionActive(pathname, item.href, hrefs);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={active ? 'page' : undefined}
                  className={linkClass(active, true)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
