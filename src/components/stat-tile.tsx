import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Плитка сводки: подпись, значение, пояснение.
 *
 * Одно число — это не график: столбик из одного столбца сообщает ровно
 * столько же, сколько само число, но занимает в десять раз больше места.
 * Поэтому сводка §6.9 сделана плитками.
 *
 * Значение набирается пропорциональными цифрами: `tabular-nums` нужен там,
 * где числа стоят колонкой, а в крупном кегле он делает число рыхлым.
 *
 * Значок и цветной рант — опознавательные знаки, а не сообщение: смысл несут
 * подпись и знак числа, и плитка читается целиком без них (§12). Поэтому
 * значок спрятан от чтения с экрана: он повторяет подпись, стоящую рядом.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'credit' | 'owes';
  icon?: LucideIcon;
}): ReactNode {
  return (
    <div
      className={cn(
        'glass-soft stat-rail relative overflow-hidden rounded-lg p-3 pl-4',
        'transition-shadow duration-200 hover:shadow-md',
        tone === 'credit' && 'stat-rail-credit',
        tone === 'owes' && 'stat-rail-owes',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs">{label}</p>
        {Icon !== undefined && (
          <Icon
            aria-hidden
            className={cn(
              'size-4 shrink-0 opacity-70',
              tone === 'credit' && 'text-credit',
              tone === 'owes' && 'text-owes',
              tone === 'neutral' && 'text-muted-foreground',
            )}
          />
        )}
      </div>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tracking-tight',
          tone === 'credit' && 'text-credit',
          tone === 'owes' && 'text-owes',
        )}
      >
        {value}
      </p>
      {hint !== undefined && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}
