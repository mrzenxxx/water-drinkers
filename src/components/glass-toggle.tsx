'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { nextGlass } from '@/lib/glass';
import { getServerSnapshot, getSnapshot, setGlass, subscribe } from '@/lib/glass-store';

/**
 * Переключатель стекла: матовое ↔ жидкое. Стоит в шапке слева от темы.
 *
 * В отличие от кнопки темы, это переключатель с состоянием (`aria-pressed`):
 * «жидкое стекло включено» — да или нет. Значок — пузырик: пустой контур в
 * матовом виде, с бликом и заливкой — в жидком.
 */
export function GlassToggle(): ReactNode {
  const style = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const liquid = style === 'liquid';
  const label = liquid ? 'Выключить жидкое стекло' : 'Включить жидкое стекло';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setGlass(nextGlass(style))}
      aria-label="Жидкое стекло"
      aria-pressed={liquid}
      title={label}
    >
      <BubbleIcon filled={liquid} />
    </Button>
  );
}

/** Пузырик: большая капля с бликом и две маленькие рядом. */
function BubbleIcon({ filled }: { filled: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
    >
      <circle
        cx="10"
        cy="13"
        r="7"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.2 : 0}
        className="transition-[fill-opacity] duration-500"
      />
      <path d="M6.8 11.2a3.6 3.6 0 0 1 2.4-2.4" />
      <circle cx="18.5" cy="6.5" r="2.25" />
      <circle cx="19.5" cy="12.5" r="1" />
    </svg>
  );
}
