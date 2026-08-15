'use client';

import {
  CalendarOff,
  ChartLine,
  Droplets,
  House,
  Menu,
  Package,
  ShieldCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { isSectionActive, type NavIcon, type NavItem } from '@/lib/view/nav';

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

/**
 * Ключ раздела → значок. Разбор стоит здесь, а не в `nav.ts`: сами значки —
 * клиентские компоненты, и их место на клиентской стороне границы.
 */
const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  wallet: Wallet,
  people: Users,
  fund: Droplets,
  orders: Package,
  absences: CalendarOff,
  dashboard: ChartLine,
  admin: ShieldCheck,
};

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
      'focus-visible:ring-ring inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none',
      block && 'w-full',
      active
        ? // Подчёркивание рядом с заливкой: текущий раздел виден и без цвета (§12).
          'glass-soft text-secondary-foreground font-medium underline underline-offset-4 shadow-sm'
        : 'text-muted-foreground hover:bg-secondary/70 hover:text-secondary-foreground',
    );
  }

  /** Ссылка раздела. Значок повторяет подпись, стоящую рядом, — и потому скрыт. */
  function sectionLink(item: NavItem, block: boolean): ReactNode {
    const active = isSectionActive(pathname, item.href, hrefs);
    const Icon = ICONS[item.icon];

    return (
      <Link
        href={item.href}
        onClick={block ? close : undefined}
        aria-current={active ? 'page' : undefined}
        className={linkClass(active, block)}
      >
        <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
        {item.label}
      </Link>
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
        className="text-muted-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-ring order-1 -ml-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>

      {/* Широкий экран: разделы строкой под логотипом. */}
      <nav aria-label="Разделы" className="order-4 hidden w-full md:block">
        <ul className="flex flex-wrap items-center gap-1">
          {items.map((item) => (
            <li key={item.href}>{sectionLink(item, false)}</li>
          ))}
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
          {items.map((item) => (
            <li key={item.href}>{sectionLink(item, true)}</li>
          ))}
        </ul>
      </nav>
    </>
  );
}
