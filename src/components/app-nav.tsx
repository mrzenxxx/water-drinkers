'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Разделы приложения.
 *
 * Клиентский компонент — единственно из-за `usePathname`: текущий раздел
 * подсвечивается, и без адреса это не сделать. Данных сюда не приходит,
 * в бандл едет только список ссылок.
 */

export type NavItem = { href: string; label: string };

/** Разделы §6.1–§6.6 и §6.9. «Админ-панель» добавляет оболочка — только роли ADMIN. */
export const APP_SECTIONS: readonly NavItem[] = [
  { href: '/', label: 'Главная' },
  { href: '/contributions', label: 'Мои взносы' },
  { href: '/contributions/all', label: 'Все взносы' },
  { href: '/fund', label: 'Фонд' },
  { href: '/orders', label: 'Заказы' },
  { href: '/absences', label: 'Отсутствия' },
  { href: '/dashboard', label: 'Дашборд' },
];

/**
 * Активен ли раздел.
 *
 * Главная — только точное совпадение, иначе она подсвечивалась бы всегда.
 * «Мои взносы» не должны загораться на «Все взносы», поэтому вложенный
 * адрес считается своим лишь до следующего сегмента.
 */
export function isSectionActive(pathname: string, href: string, siblings: readonly string[]): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  // Более длинный подходящий адрес забирает подсветку себе.
  return !siblings.some(
    (sibling) =>
      sibling !== href &&
      sibling.length > href.length &&
      (pathname === sibling || pathname.startsWith(`${sibling}/`)),
  );
}

export function AppNav({ items }: { items: readonly NavItem[] }): ReactNode {
  const pathname = usePathname();
  const hrefs = items.map((item) => item.href);

  return (
    <nav aria-label="Разделы">
      <ul className="flex flex-wrap items-center gap-1">
        {items.map((item) => {
          const active = isSectionActive(pathname, item.href, hrefs);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  active
                    ? // Подчёркивание рядом с заливкой: текущий раздел виден
                      // и без цвета (§12).
                      'bg-secondary text-secondary-foreground font-medium underline underline-offset-4'
                    : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
