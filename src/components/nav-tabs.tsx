'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { NAV_ICONS } from '@/components/nav-icons';
import { cn } from '@/lib/utils';
import {
  isSectionActive,
  navHrefs,
  sectionTabs,
  type NavItem,
  type NavSection,
} from '@/lib/view/nav';

/**
 * Вкладки внутри открытого раздела — полосой над содержимым.
 *
 * Разделы и вкладки отвечают на разные вопросы: полоса разделов (`main-nav.tsx`)
 * говорит «где я», вкладки — «что здесь ещё есть». Поэтому вкладки не
 * дублируются в списке разделов: иначе одно и то же место было бы названо
 * дважды, а короткий список мест превратился бы в дерево.
 *
 * Вкладки — настоящие маршруты, а не состояние: ссылкой на «Все взносы» можно
 * поделиться, и она откроется всеми взносами. Клиентский компонент здесь
 * оправдан ровно одним: подсветка текущей вкладки выводится из адреса.
 */

function TabLink({ item, active }: { item: NavItem; active: boolean }): ReactNode {
  const Icon = NAV_ICONS[item.icon];
  const badge = item.badge ?? 0;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      title={item.hint ?? item.label}
      className={cn(
        'inline-flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground border-transparent',
      )}
    >
      {/* Значок повторяет подпись, стоящую рядом, — и потому декоративен. */}
      <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
      {item.label}
      {badge > 0 && (
        <>
          <span
            aria-hidden
            className="bg-primary text-primary-foreground ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
          >
            {badge}
          </span>
          {/*
            «Объявления 3» звучит как порядковый номер раздела, поэтому
            читалке смысл говорится словами, а цифра рядом от неё скрыта.
          */}
          <span className="sr-only">, непрочитанных: {badge}</span>
        </>
      )}
    </Link>
  );
}

/**
 * Полоса вкладок. Уезжает по горизонтали, а не переносится на второй ряд:
 * второй ряд — это ровно та лишняя высота, от которой мы уходили.
 */
function TabRow({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <nav
      aria-label={label}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="border-border/70 flex min-w-max gap-1 border-b pb-px">{children}</ul>
    </nav>
  );
}

/**
 * Вкладки текущего раздела. Раздел без вкладок не рисует ничего — полоса
 * появляется только там, где есть между чем выбирать.
 */
export function SectionTabs({ items }: { items: readonly NavSection[] }): ReactNode {
  const pathname = usePathname();
  const tabs = sectionTabs(pathname, items);
  if (tabs.length === 0) return null;

  const hrefs = navHrefs(items);

  return (
    <TabRow label="Вкладки раздела">
      {tabs.map((tab) => (
        <li key={tab.href}>
          <TabLink item={tab} active={isSectionActive(pathname, tab.href, hrefs)} />
        </li>
      ))}
    </TabRow>
  );
}
