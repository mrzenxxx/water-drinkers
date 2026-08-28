'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toggleSidebar,
} from '@/lib/nav-mode-store';

/**
 * Свернуть или развернуть боковую панель.
 *
 * Кнопка стоит в верхней полосе, рядом со знаком приложения, а не внутри
 * панели: в свёрнутой полосе шириной в один значок ей негде поместиться, и
 * она пряталась бы ровно тогда, когда нужнее всего. Здесь её место не зависит
 * от состояния панели — а значит, целиться в неё можно не глядя.
 *
 * Значок показывает, что произойдёт по нажатию, а не что включено сейчас:
 * кнопка — это действие.
 *
 * Показом заведует `globals.css`, а не утилиты Tailwind: правило зависит от
 * `data-nav` на `<html>` (без панели сворачивать нечего), а утилиты лежат
 * слоем выше компонентов и перекрыли бы его. Поэтому здесь обычная кнопка
 * без `display`-утилит — как и бургер рядом.
 */
export function SidebarToggle(): ReactNode {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const collapsed = mode.sidebar === 'collapsed';
  const label = collapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      title={`${label} · Ctrl + B`}
      className="sidebar-toggle text-muted-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-ring size-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
