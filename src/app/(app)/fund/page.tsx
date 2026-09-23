import { Coins } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Amount, HeroAmount } from '@/components/amount';
import { BalanceBreakdown } from '@/components/balance-breakdown';
import { FundFlowChart, type FlowStep } from '@/components/charts/fund-flow-chart';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { isCountedStatus } from '@/lib/calc';
import { fundFlowStats } from '@/lib/data';
import { fundState, listContributions, listOrders, peopleById } from '@/lib/data/queries';
import { formatDate, fullName } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { pageTitle } from '@/lib/view/app';
import { bucketKeyOf, bucketTitle, nextBucketKey, type RawParams } from '@/lib/view/filters';

/**
 * Фонд (§6.4).
 *
 * Здесь стоит обещанная брифом проверяемость: остаток и сумма балансов
 * показаны рядом с отметкой схождения (§5, пункт 3). Расхождение — всегда
 * баг в коде, поэтому оно не прячется и не «допускается в пределах копейки».
 */
const STEP_LABEL: Record<FlowStep, string> = { month: 'Месяцы', week: 'Недели' };

/** Шаг графика из адреса: `?step=week` — недели, всё остальное — месяцы. */
function readStep(params: RawParams): FlowStep {
  const value = params.step;
  return (Array.isArray(value) ? value[0] : value) === 'week' ? 'week' : 'month';
}

export default async function FundPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<ReactNode> {
  const currentUser = await requirePageUser();

  const [params, state, byId, orders, allContributions] = await Promise.all([
    searchParams,
    fundState(),
    peopleById(),
    listOrders(),
    listContributions(),
  ]);
  // Подтверждённые и внесённые администратором — те, что двигают деньги.
  const contributions = allContributions.filter((row) => isCountedStatus(row.status));

  const step = readStep(params);
  const stats = fundFlowStats(state.input, state.result, bucketKeyOf(step), nextBucketKey(step));
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  const contributionsByUser = new Map<string, typeof contributions>();
  for (const row of contributions) {
    const bucket = contributionsByUser.get(row.userId);
    if (bucket === undefined) contributionsByUser.set(row.userId, [row]);
    else bucket.push(row);
  }

  const balances = [...state.result.balances].sort((a, b) => a.amount - b.amount);
  const { invariant } = state;

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Фонд')}</title>

      <PageHeader icon={Coins} title="Фонд">
        Сколько денег в кассе, откуда они взялись и на кого разложены.
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Остаток фонда</CardDescription>
            <CardTitle className="mt-1">
              <HeroAmount value={state.result.fundBalance} tone="neutral" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-sm">
            <p>
              Начальное сальдо: <Amount value={state.input.fund.openingBalance} signed />
              {state.input.fund.startDate !== null && (
                <> на {formatDate(state.input.fund.startDate)}</>
              )}
            </p>
            <p>Типовой взнос: {formatKopecks(state.input.fund.defaultContribution)}</p>
          </CardContent>
        </Card>

        {/*
          Сходимость инварианта §5: обе величины рядом, разница — третьей
          строкой. Отметка не только цветная: рядом стоит слово (§12).
        */}
        <Card className={invariant.isConsistent ? undefined : 'border-owes'}>
          <CardHeader>
            <CardTitle>Сходимость</CardTitle>
            <CardDescription>
              Σ балансов всех участников обязана точно равняться остатку фонда.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Остаток фонда</span>
              <Amount value={invariant.fundBalance} />
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Σ балансов</span>
              <Amount value={invariant.balancesSum} />
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Расхождение</span>
              <Amount
                value={invariant.difference}
                tone={invariant.isConsistent ? 'neutral' : 'owes'}
                signed
              />
            </p>
            <p
              className={
                invariant.isConsistent ? 'text-credit font-medium' : 'text-owes font-medium'
              }
            >
              {invariant.isConsistent
                ? '✓ Сходится до копейки'
                : '✗ Не сходится — это ошибка в коде, а не в данных'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Динамика по {step === 'month' ? 'месяцам' : 'неделям'}</CardTitle>
            <CardDescription>
              Сверху — сколько поступило и сколько потрачено за{' '}
              {step === 'month' ? 'месяц' : 'неделю'}, снизу — остаток на{' '}
              {step === 'month' ? 'его' : 'её'} конец.
            </CardDescription>
          </div>
          {/* Ссылки, а не кнопки: шаг живёт в адресе, и ссылкой можно поделиться. */}
          <nav className="segmented" aria-label="Шаг графика">
            {(['month', 'week'] as const).map((option) => (
              <Link
                key={option}
                href={option === 'month' ? '/fund' : '/fund?step=week'}
                scroll={false}
                replace
                aria-current={option === step ? 'true' : undefined}
                className="segment"
              >
                {STEP_LABEL[option]}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          <FundFlowChart stats={stats} step={step} />

          {/* Табличный двойник графика: значение никогда не спрятано в подсказку. */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm underline underline-offset-4">
              Показать те же числа таблицей
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1 pr-4 font-medium">{step === 'month' ? 'Месяц' : 'Неделя'}</th>
                    <th className="py-1 pr-4 text-right font-medium">Поступило</th>
                    <th className="py-1 pr-4 text-right font-medium">Потрачено</th>
                    <th className="py-1 text-right font-medium">Остаток на конец</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat) => (
                    <tr key={stat.start} className="border-border border-t">
                      <td className="py-1 pr-4">{bucketTitle(stat.start, step)}</td>
                      <td className="py-1 pr-4 text-right">
                        <Amount value={stat.contributions} />
                      </td>
                      <td className="py-1 pr-4 text-right">
                        <Amount value={stat.orders} signed />
                      </td>
                      <td className="py-1 text-right">
                        <Amount value={stat.endBalance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Балансы участников</CardTitle>
          <CardDescription>
            Любое число можно раскрыть: нажмите на строку — покажем взносы, заказы,
            дни присутствия и долю.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {balances.map((balance) => {
              const person = byId.get(balance.userId);
              const isMe = balance.userId === currentUser.id;

              return (
                <li key={balance.userId} className="border-border border-b last:border-b-0">
                  <details className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 py-3">
                      <span className="min-w-0 truncate text-sm">
                        {person === undefined ? balance.userId : fullName(person)}
                        {isMe && <span className="text-muted-foreground"> — это вы</span>}
                        {person?.leftAt != null && (
                          <span className="text-muted-foreground text-xs">
                            {' '}
                            · вышел {formatDate(person.leftAt)}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <Amount value={balance.amount} tone="auto" signed />
                        <span
                          aria-hidden
                          className="text-muted-foreground text-xs group-open:hidden"
                        >
                          раскрыть
                        </span>
                        <span
                          aria-hidden
                          className="text-muted-foreground hidden text-xs group-open:inline"
                        >
                          свернуть
                        </span>
                      </span>
                    </summary>

                    <div className="pb-4">
                      <BalanceBreakdown
                        balance={balance}
                        orders={ordersById}
                        contributions={contributionsByUser.get(balance.userId) ?? []}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
