'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/components/theme-provider';
import type { ThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Светлая', Icon: Sun },
  { value: 'system', label: 'Системная', Icon: Monitor },
  { value: 'dark', label: 'Тёмная', Icon: Moon },
];

export function ThemeToggle(): ReactNode {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Тема оформления"
      className="inline-flex items-center gap-1 rounded-lg border border-input bg-card p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-pressed={active}
            title={label}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
            )}
          >
            <Icon aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
