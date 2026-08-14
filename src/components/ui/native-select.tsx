import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Обычный `<select>` в стиле остальных полей.
 *
 * Рядом лежит `select.tsx` на Radix — он красивее, но требует клиентского
 * компонента и состояния. В админ-панели выпадающие списки стоят внутри
 * серверных форм (`<form action={…}>`), где родной элемент отправляется сам,
 * работает без JavaScript и не тянет ничего в бандл.
 */
function NativeSelect({ className, children, ...props }: ComponentProps<'select'>): ReactNode {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'border-input bg-background h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
