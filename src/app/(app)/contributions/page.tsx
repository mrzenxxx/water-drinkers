import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { MyContributions } from '@/components/my-contributions';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listContributions, listPeople } from '@/lib/data/queries';
import { CONTRIBUTIONS, withCount } from '@/lib/format';
import { toRublesString } from '@/lib/money';
import { pageTitle } from '@/lib/view/app';

/**
 * Мои взносы (§6.2).
 *
 * Данные читает серверный компонент, форму отправляет серверное действие —
 * клиентского запроса к собственному GraphQL здесь нет (§12а).
 */
export default async function MyContributionsPage(): Promise<ReactNode> {
  const user = await requirePageUser();

  const [rows, people, state] = await Promise.all([
    listContributions({ userId: user.id }),
    listPeople(),
    fundState(),
  ]);

  const confirmed = rows.filter((row) => row.status === 'CONFIRMED');
  const pending = rows.filter((row) => row.status === 'PENDING');
  const total = confirmed.reduce((sum, row) => sum + row.amount, 0);
  const pendingTotal = pending.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Мои взносы')}</title>

      <PageHeader icon={Wallet} title="Мои взносы">
        Взнос влияет на баланс только после подтверждения администратором.
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Итого</CardTitle>
          <CardDescription>Что уже засчитано и что ещё ждёт проверки.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <p className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
            <span className="text-muted-foreground">Подтверждено</span>
            <Amount value={total} className="text-lg font-semibold" />
          </p>
          <p className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
            <span className="text-muted-foreground">
              Ждёт подтверждения ({withCount(pending.length, CONTRIBUTIONS)})
            </span>
            <Amount value={pendingTotal} className="text-lg font-semibold" />
          </p>
          <p className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-1">
            <span className="text-muted-foreground">Ваш баланс сейчас</span>
            <Amount
              value={state.balanceOf(user.id)?.amount ?? 0}
              tone="auto"
              signed
              className="text-lg font-semibold"
            />
          </p>
        </CardContent>
      </Card>

      {/*
        Форма и история живут в одном компоненте — он же рисует обе плашки:
        только так поданный взнос появляется в списке сразу, ещё до ответа
        сервера (`useOptimistic`).
      */}
      <MyContributions
        rows={rows}
        people={people}
        today={todayIso()}
        suggestedAmount={toRublesString(state.input.fund.defaultContribution)}
        readOnly={user.restriction === 'MUTED'}
      />
    </div>
  );
}
