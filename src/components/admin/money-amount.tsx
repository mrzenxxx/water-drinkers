import type { ReactNode } from 'react';

import { formatKopecks, type Kopecks } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Денежная величина со знаком и подписью.
 *
 * Цвет никогда не единственный носитель смысла (§12): рядом с суммой всегда
 * стоит знак, а у баланса — ещё и слово «должен» или «остаток». Дальтонику
 * и в монохромной печати текст читается так же.
 */
export function MoneyAmount({
  amount,
  className,
  alwaysSign = false,
}: {
  amount: Kopecks;
  className?: string;
  alwaysSign?: boolean;
}): ReactNode {
  return (
    <span className={cn('tabular whitespace-nowrap', className)}>
      {formatKopecks(amount, { alwaysSign })}
    </span>
  );
}

/** Баланс участника: сумма, цвет и слово, отвечающее на вопрос «должен или нет». */
export function BalanceAmount({ amount, className }: { amount: Kopecks; className?: string }): ReactNode {
  const owes = amount < 0;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <MoneyAmount
        amount={amount}
        alwaysSign
        className={cn('font-medium', owes ? 'text-owes' : 'text-credit')}
      />
      <span className="text-muted-foreground text-xs">{owes ? 'должен' : 'остаток'}</span>
    </span>
  );
}
