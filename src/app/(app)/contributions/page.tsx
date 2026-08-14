import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { ContributionForm } from '@/components/contribution-form';
import { ContributionsList } from '@/components/contributions-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listContributions, peopleById } from '@/lib/data/queries';
import { CONTRIBUTIONS, withCount } from '@/lib/format';
import { toRublesString } from '@/lib/money';

/**
 * Мои взносы (§6.2).
 *
 * Данные читает серверный компонент, форму отправляет серверное действие —
 * клиентского запроса к собственному GraphQL здесь нет (§12а).
 */
export default async function MyContributionsPage(): Promise<ReactNode> {
  const user = await requirePageUser();

  const [rows, byId, state] = await Promise.all([
    listContributions({ userId: user.id }),
    peopleById(),
    fundState(),
  ]);

  const confirmed = rows.filter((row) => row.status === 'CONFIRMED');
  const pending = rows.filter((row) => row.status === 'PENDING');
  const total = confirmed.reduce((sum, row) => sum + row.amount, 0);
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <title>Мои взносы — WaterDrinkers</title>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Мои взносы</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Взнос влияет на баланс только после подтверждения администратором.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Новый взнос</CardTitle>
            <CardDescription>
              После отправки взнос уходит в очередь на подтверждение.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContributionForm
              today={todayIso()}
              suggestedAmount={toRublesString(state.input.fund.defaultContribution)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Итого</CardTitle>
            <CardDescription>Что уже засчитано и что ещё ждёт проверки.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Подтверждено</span>
              <Amount value={total} className="text-lg font-semibold" />
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">
                Ждёт подтверждения ({withCount(pending.length, CONTRIBUTIONS)})
              </span>
              <Amount value={pendingTotal} />
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Ваш баланс сейчас</span>
              <Amount value={state.balanceOf(user.id)?.amount ?? 0} tone="auto" signed />
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
          <CardDescription>
            У отклонённого взноса видна причина отказа — её оставляет администратор.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionsList
            rows={rows}
            people={byId}
            emptyText="Вы ещё не подавали взносов."
          />
        </CardContent>
      </Card>
    </div>
  );
}
