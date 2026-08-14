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
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'credit' | 'owes';
}): ReactNode {
  return (
    <div className="border-border rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
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
