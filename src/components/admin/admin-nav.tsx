'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Четыре вкладки админ-панели (§6.7).
 *
 * Клиентский компонент здесь оправдан: подсветка текущей вкладки выводится из
 * адреса страницы (`usePathname`). Вкладки — настоящие маршруты, а не состояние:
 * ссылкой на «Журнал» можно поделиться, и она откроется журналом.
 */
const TABS: ReadonlyArray<{ href: string; label: string; hint: string }> = [
  { href: '/admin/queue', label: 'Очередь', hint: 'Взносы на подтверждение' },
  { href: '/admin/participants', label: 'Участники', hint: 'Состав и балансы' },
  { href: '/admin/entry', label: 'Ввод за участника', hint: 'Взнос и отсутствие' },
  { href: '/admin/journal', label: 'Журнал', hint: 'Аудит и корректировки' },
];

export function AdminNav(): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Разделы админ-панели" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-border pb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                title={tab.hint}
                className={cn(
                  'inline-flex items-center rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                  active
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
