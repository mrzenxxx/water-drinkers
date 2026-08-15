import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import type { Balance } from '@/lib/calc/types';
import type { ContributionRow, OrderRow } from '@/lib/data/queries';
import { DAYS, PERSON_DAYS, formatDate, withCount } from '@/lib/format';
import { formatKopecks } from '@/lib/money';

/**
 * Раскрытие баланса (§6.4) — «любое число можно раскрыть» из брифа.
 *
 * Построчная выкладка ровно по формуле §4.5:
 *
 *     Баланс = начальное сальдо + взносы − расход + выплаты и корректировки
 *
 * Здесь не считается ничего нового: все слагаемые приходят из единственной
 * точки пересчёта. Собственная арифметика на экране означала бы второй ответ
 * на тот же вопрос — и однажды другой.
 *
 * Раскрытие сделано на `<details>`: это состояние браузера, а не React, поэтому
 * компонент остаётся серверным и в бандл не едет.
 */
export function BalanceBreakdown({
  balance,
  orders,
  contributions,
}: {
  balance: Balance;
  /** Заказы по id — из них берутся дата и полная стоимость. */
  orders: ReadonlyMap<string, OrderRow>;
  /** Подтверждённые взносы этого участника, свежие сверху. */
  contributions: readonly ContributionRow[];
}): ReactNode {
  const { breakdown } = balance;

  const lines: { label: string; value: number; signed?: boolean }[] = [
    { label: 'Начальное сальдо', value: breakdown.openingBalance, signed: true },
    { label: 'Подтверждённые взносы', value: breakdown.contributionsTotal },
    { label: 'Расход по заказам', value: -breakdown.expensesTotal, signed: true },
  ];

  if (breakdown.settlementsTotal !== 0) {
    lines.push({ label: 'Выплаты', value: breakdown.settlementsTotal, signed: true });
  }
  if (breakdown.adjustmentsTotal !== 0) {
    lines.push({ label: 'Корректировки', value: breakdown.adjustmentsTotal, signed: true });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="flex flex-col">
        {lines.map((line) => (
          <div
            key={line.label}
            className="border-border flex items-baseline justify-between gap-3 border-b py-1.5"
          >
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd>
              <Amount value={line.value} signed={line.signed} />
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2 font-medium">
          <dt>Баланс</dt>
          <dd>
            <Amount value={balance.amount} tone="auto" signed />
          </dd>
        </div>
      </dl>

      <section>
        <h4 className="mb-2 font-medium">Взносы</h4>
        {contributions.length === 0 ? (
          <p className="text-muted-foreground">Подтверждённых взносов нет.</p>
        ) : (
          <ul className="flex flex-col">
            {contributions.map((row) => (
              <li
                key={row.id}
                className="border-border flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0"
              >
                <span className="tabular text-muted-foreground">{formatDate(row.paidAt)}</span>
                <Amount value={row.amount} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 font-medium">Доли в заказах</h4>
        {breakdown.orderShares.length === 0 ? (
          <p className="text-muted-foreground">
            Заказов, которые пришлись бы на этого участника, ещё не было.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {breakdown.orderShares.map((share) => {
              const order = orders.get(share.orderId);
              return (
                <li key={share.orderId} className="glass-soft rounded-md p-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular">
                      {order === undefined ? 'Заказ' : formatDate(order.orderedAt)}
                      {order !== undefined && (
                        <span className="text-muted-foreground">
                          {' '}
                          · заказ на {formatKopecks(order.amount)}
                        </span>
                      )}
                    </span>
                    <Amount value={-share.share} tone="neutral" signed />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {withCount(share.daysPresent, DAYS)} присутствия из{' '}
                    {withCount(share.totalPersonDays, PERSON_DAYS)} за период потребления
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
