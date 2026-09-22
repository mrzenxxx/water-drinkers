import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Стеклянная карточка, которая сворачивается.
 *
 * Сделана на `<details>`, а не на состоянии React: сворачивание работает без
 * JavaScript, с клавиатуры и в читалке экрана из коробки, а компонент остаётся
 * серверным. Рядом с заголовком может стоять `meta` — например, границы
 * периода у сводки.
 */
export function FoldCard({
  title,
  meta,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <details open={defaultOpen} className={cn('glass group rounded-xl', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-x-3 gap-y-0.5 rounded-xl px-5 py-3 select-none',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-lg leading-tight font-semibold">{title}</h2>
          {meta !== undefined && (
            <span className="text-muted-foreground min-w-0 text-sm">{meta}</span>
          )}
        </div>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
