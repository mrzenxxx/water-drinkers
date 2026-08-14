'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

/**
 * Кнопка отправки формы с индикатором ожидания.
 *
 * Ожидание берётся из `useFormStatus` (React 19), а не из своего `useState`:
 * ручной флаг — это второй источник правды, который рано или поздно
 * разъезжается с настоящим состоянием отправки (CLAUDE.md).
 *
 * Хук работает только внутри `<form>`, поэтому кнопка обязана быть отдельным
 * компонентом: в самой форме `useFormStatus` вернул бы `pending: false`.
 */

type SubmitButtonProps = {
  children: ReactNode;
  /** Подпись на время отправки. */
  pendingLabel?: string;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function SubmitButton({
  children,
  pendingLabel = 'Отправляем…',
  className,
  variant,
  size,
}: SubmitButtonProps): ReactNode {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
