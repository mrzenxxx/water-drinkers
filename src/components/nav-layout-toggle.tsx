'use client';

import { PanelLeft, PanelTop } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toggleNavLayout,
} from '@/lib/nav-mode-store';

/**
 * Переключатель формы навигации: список слева ⇄ вкладки под шапкой.
 *
 * Как и у переключателя темы, значок показывает, что произойдёт по нажатию,
 * а не что включено сейчас: кнопка — это действие. Подпись живёт в
 * `aria-label` и `title`, поэтому в шапке она не занимает места, но остаётся
 * и для чтения с экрана, и для подсказки при наведении (§12).
 *
 * На узком экране выбора нет — там разделы всегда в выезжающем ящике, строке
 * для них не хватит ширины, — поэтому кнопки там тоже нет.
 */
export function NavLayoutToggle(): ReactNode {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toTabs = mode.layout === 'sidebar';
  const label = toTabs ? 'Разделы строкой вкладок' : 'Разделы боковой панелью';
  const Icon = toTabs ? PanelTop : PanelLeft;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleNavLayout}
      aria-label={label}
      title={label}
      className="hidden md:inline-flex"
    >
      <Icon aria-hidden className="size-5" />
    </Button>
  );
}
