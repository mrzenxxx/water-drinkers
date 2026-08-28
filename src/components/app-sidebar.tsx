'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { NAV_ICONS } from '@/components/nav-icons';
import { cn } from '@/lib/utils';
import { isSectionActive, navHrefs, sectionHrefs, type NavSection } from '@/lib/view/nav';

/**
 * Боковая панель разделов.
 *
 * Форму навигации выбирает человек (`NavLayoutToggle`): в режиме вкладок
 * панели на широком экране нет вовсе, разделы уходят строкой под шапку.
 * Здесь же — три состояния самой панели, а не три панели:
 *
 * - **развёрнута** — значки с подписями, содержимое страницы отодвинуто на
 *   ширину панели (`--sidebar-w` в `globals.css` двигает и панель, и отступ,
 *   поэтому вёрстка подстраивается сама, без второго размера в разметке);
 * - **свёрнута** — узкая полоса одних значков; подписи возвращаются, стоит
 *   подвести курсор или увести туда фокус, и панель раскрывается **поверх**
 *   содержимого. Выбрал раздел, увёл курсор — полоса вернулась сама. Это
 *   поведение чистого CSS: состояние «сейчас на панель смотрят» не нужно
 *   держать в React, `:hover` и `:focus-within` знают его точнее.
 * - **ящик** на узком экране — выезжает по бургеру поверх затемнения. Выбора
 *   формы там нет: строке разделов не хватило бы ширины.
 *
 * Панель начинается **под** верхней полосой и никогда её не перекрывает:
 * знак приложения и кнопка сворачивания живут в самой полосе, поэтому шва
 * между ними и панелью нет ни в одном состоянии. Значок раздела стоит ровно
 * под знаком приложения — 34 пикселя от края — и в свёрнутой полосе остаётся
 * на том же месте, что и в развёрнутой: сворачивание не должно двигать то,
 * во что человек целится.
 *
 * Пристыкованная панель прозрачна — она ничего не перекрывает, и подписи
 * стоят прямо на фоне приложения. Стекло появляется ровно тогда, когда панель
 * ложится поверх страницы; правило живёт в `globals.css`.
 *
 * Ящик узкого экрана помнит адрес, на котором его открыли: ушли в другой
 * раздел — адрес сменился, и ящик закрыт сам собой, без `useEffect` и без
 * подписки на маршрутизатор (CLAUDE.md, React 19).
 *
 * Панель отрисована `position: fixed`, поэтому её место в разметке значения
 * не имеет: она вложена в шапку, чтобы делить с бургером одно состояние.
 */

const DRAWER_ID = 'app-sidebar';

export function AppSidebar({ items }: { items: readonly NavSection[] }): ReactNode {
  const pathname = usePathname();

  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const close = (): void => setOpenedAt(null);

  const hrefs = navHrefs(items);

  function escapes(event: { key: string }): void {
    if (event.key === 'Escape') close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenedAt(open ? null : pathname)}
        onKeyDown={escapes}
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        aria-label={open ? 'Закрыть разделы' : 'Разделы'}
        className="text-muted-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-ring -ml-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>

      {/*
        Затемнение под ящиком: нажатие мимо панели закрывает её. Отрисовывается
        только на узком экране и только открытым — на широком ящика нет вовсе.
        Верхнюю полосу оно не затемняет: бургер обязан остаться нажимаемым.
      */}
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={close}
          className="bg-foreground/25 fixed inset-x-0 top-16 bottom-0 z-30 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        id={DRAWER_ID}
        data-open={open}
        aria-label="Разделы"
        onKeyDown={escapes}
        className="sidebar-panel glass-strong fixed top-16 bottom-0 left-0 z-30 rounded-none border-y-0 border-l-0"
      >
        <div className="sidebar-inner flex h-full flex-col">
          <nav
            aria-label="Разделы приложения"
            className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4"
          >
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const active = sectionHrefs(item).some((href) =>
                  isSectionActive(pathname, href, hrefs),
                );
                const Icon = NAV_ICONS[item.icon];
                const badge = item.badge ?? 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      title={item.hint ?? item.label}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'sidebar-link focus-visible:ring-ring relative flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none',
                        active
                          ? 'glass-soft text-foreground font-medium shadow-sm'
                          : 'text-muted-foreground hover:bg-secondary/70 hover:text-secondary-foreground',
                      )}
                    >
                      <span className="relative flex size-6 shrink-0 items-center justify-center">
                        <Icon aria-hidden className="size-[1.15rem]" />
                        {badge > 0 && (
                          /*
                            Свёрнутой полосе счётчик не по размеру, но факт
                            непрочитанного скрывать нельзя: число уступает
                            место точке. Смысл всё равно сказан текстом ниже.
                          */
                          <span
                            aria-hidden
                            className="sidebar-dot bg-primary ring-card absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
                          />
                        )}
                      </span>

                      <span className="sidebar-collapsible truncate">{item.label}</span>

                      {badge > 0 && (
                        <>
                          <span
                            aria-hidden
                            className="sidebar-collapsible bg-primary text-primary-foreground ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
                          >
                            {badge}
                          </span>
                          {/*
                            «Объявления 3» звучит как порядковый номер раздела,
                            поэтому читалке смысл говорится словами, а цифра
                            рядом от неё скрыта.
                          */}
                          <span className="sr-only">, непрочитанных: {badge}</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="sidebar-collapsible sidebar-hint border-border/60 text-muted-foreground shrink-0 border-t px-4 py-3 text-xs">
            <kbd className="bg-secondary/70 rounded px-1 py-0.5 font-sans">Ctrl</kbd>
            {' + '}
            <kbd className="bg-secondary/70 rounded px-1 py-0.5 font-sans">B</kbd> — свернуть панель
          </p>
        </div>
      </aside>
    </>
  );
}
