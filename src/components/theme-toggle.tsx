'use client';

import { Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { nextTheme } from '@/lib/theme';

/**
 * Переключатель темы: одна иконка, два состояния.
 *
 * Иконка показывает, что произойдёт по нажатию, а не что включено сейчас:
 * кнопка — это действие. Подпись живёт в `aria-label` и `title`, поэтому
 * в шапке она не занимает места, но остаётся и для чтения с экрана,
 * и для подсказки при наведении (§12).
 */
export function ThemeToggle(): ReactNode {
  const { resolved, setPreference } = useTheme();

  const target = nextTheme(resolved);
  const label = target === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему';
  const Icon = target === 'dark' ? Moon : Sun;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setPreference(target)}
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden className="size-5" />
    </Button>
  );
}
