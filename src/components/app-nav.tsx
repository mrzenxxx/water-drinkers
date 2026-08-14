'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { isSectionActive, type NavItem } from '@/lib/view/nav';

/**
 * Разделы приложения.
 *
 * Клиентский компонент — единственно из-за `usePathname`: текущий раздел
 * подсвечивается, и без адреса это не сделать. Данных сюда не приходит,
 * в бандл едет только список ссылок.
 *
 * Сам список разделов лежит в `@/lib/view/nav` и отсюда **не** реэкспортируется:
 * значение, вывезенное через клиентскую границу, приезжает на сервер ссылкой на
 * клиентскую сущность, а не массивом (см. комментарий в том файле).
 */

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
