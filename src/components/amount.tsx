import type { ReactNode } from 'react';

import { formatKopecks } from '@/lib/money';
import type { Kopecks } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Денежная величина на экране.
 *
 * Правило §12: цвет никогда не единственный носитель смысла. Поэтому у знаковых
 * величин знак печатается всегда — «−340,00 ₽» читается как долг и в
 * чёрно-белой распечатке, и при полной цветовой слепоте, и цвет только
 * подхватывает то, что уже сказано символом.
 *
 * `tone="auto"` окрашивает по знаку: минус — тёплый акцент долга, плюс —
 * спокойный синий. `tone="neutral"` оставляет цвет текста: суммы в таблицах,
 * где знак ничего не значит (стоимость заказа сама по себе не долг).
 */

export type AmountTone = 'auto' | 'neutral' | 'credit' | 'owes';

type AmountProps = {
  value: Kopecks;
  tone?: AmountTone;
  /** Печатать `+` у положительных. Для знаковых величин — да. */
  signed?: boolean;
  className?: string;
};

function toneClass(tone: AmountTone, value: Kopecks): string {
  if (tone === 'neutral') return '';
  if (tone === 'credit') return 'text-credit';
  if (tone === 'owes') return 'text-owes';
  return value < 0 ? 'text-owes' : 'text-credit';
}

export function Amount({
  value,
  tone = 'neutral',
  signed = false,
  className,
}: AmountProps): ReactNode {
  return (
    <span className={cn('tabular', toneClass(tone, value), className)}>
      {formatKopecks(value, { alwaysSign: signed })}
    </span>
  );
}

/**
 * Крупное число, которое читается раньше текста (§12).
 *
 * Размер и цвет отвечают на «должен или нет» до того, как человек дочитает
 * подпись, — но подпись всё равно стоит рядом, см. шапку файла.
 * Начертание пропорциональное, не табличное: в крупном кегле `tabular-nums`
 * растягивает число и оно выглядит рыхлым.
 */
export function HeroAmount({
  value,
  tone = 'auto',
  signed = false,
  className,
}: AmountProps): ReactNode {
  return (
    <span
      className={cn(
        'text-4xl font-semibold tracking-tight sm:text-5xl',
        toneClass(tone, value),
        className,
      )}
    >
      {formatKopecks(value, { alwaysSign: signed })}
    </span>
  );
}
