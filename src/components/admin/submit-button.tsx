'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Кнопка отправки, знающая о состоянии своей формы.
 *
 * Ожидание берётся из `useFormStatus` (React 19), а не из ручного флага
 * в `useState`: флаг пришлось бы поднимать и опускать в двух местах и он
 * неизбежно разъехался бы с настоящим состоянием отправки.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Сохраняем…',
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }): ReactNode {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
