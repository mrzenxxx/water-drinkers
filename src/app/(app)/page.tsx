import Link from 'next/link';
import type { ReactNode } from 'react';

import { ActivityFeed } from '@/components/activity-feed';
import { Amount, HeroAmount } from '@/components/amount';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listPeople, peopleById, timelineSource } from '@/lib/data/queries';
import { fullName } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { buildEvents } from '@/lib/view/events';

/**
 * Главная (§6.1).
 *
 * Экран обязан читаться без чтения (§12): размер и цвет числа отвечают на
 * «должен или нет» раньше, чем человек дочитает подпись. Подпись при этом
 * стоит рядом всегда — цвет не единственный носитель смысла.
 *
 * Серверный компонент: данные берутся `await`-ом прямо из слоя данных,
 * без HTTP к собственному `/api/graphql` (§12а).
 */

/** Сколько событий показывать в ленте. Дальше — дашборд. */
const FEED_LIMIT = 12;

export default async function HomePage(): Promise<ReactNode> {
  const user = await requirePageUser();

  const [state, people, byId, source] = await Promise.all([
    fundState(),
    listPeople(),
    peopleById(),
    timelineSource(),
  ]);

  const today = todayIso();
  const myBalance = state.balanceOf(user.id);
  const amount = myBalance?.amount ?? 0;
  const owes = amount < 0;

  // Очередь должников видна всем — это обещание брифа, а не утечка (§6.1).
  const debtors = state.result.balances
    .filter((balance) => balance.amount < 0)
    .sort((a, b) => a.amount - b.amount);

  const events = buildEvents(source)
    .slice()
    .reverse()
    .slice(0, FEED_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <title>Главная — WaterDrinkers</title>

      <div className="grid gap-4 md:grid-cols-2">
        {/*
          Личный баланс — первый и самый крупный: человек заходит сюда, чтобы
          узнать, должен он или нет.
        */}
        <Card className={owes ? 'border-owes/50' : undefined}>
          <CardHeader>
            <CardDescription>Ваш баланс</CardDescription>
            <CardTitle className="mt-1">
              <HeroAmount value={amount} tone="auto" signed />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className={owes ? 'text-owes font-medium' : 'text-credit font-medium'}>
              {owes
                ? `Ты должен ${formatKopecks(-amount)}`
                : 'Пока скидываться не надо'}
            </p>
            <p className="text-muted-foreground text-sm">
              {owes
                ? 'Внесите взнос и приложите чек — администратор подтвердит его, и баланс обновится.'
                : 'Взносы покрывают вашу долю в заказах. Как только баланс уйдёт в минус, здесь появится сумма.'}
            </p>
            <Button asChild size="sm">
              <Link href="/contributions">Мои взносы</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Остаток фонда</CardDescription>
            <CardTitle className="mt-1">
              <HeroAmount value={state.result.fundBalance} tone="neutral" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Деньги, которые есть у кассы прямо сейчас. Сумма балансов всех участников
              равна этому числу — сходимость видна в разделе «Фонд».
            </p>
            <p className="text-sm">
              Участников в составе:{' '}
              <span className="tabular font-medium">
                {people.filter((person) => person.leftAt === null).length}
              </span>
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/fund">Раскрыть расчёт</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Кто в минусе</CardTitle>
            <CardDescription>
              Очередь видна всем: приложение прозрачно, участник видит то же, что администратор.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debtors.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Никто не должен фонду. Хороший день.
              </p>
            ) : (
              <ul className="flex flex-col">
                {debtors.map((balance) => {
                  const person = byId.get(balance.userId);
                  return (
                    <li
                      key={balance.userId}
                      className="border-border flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                    >
                      <span className="min-w-0 truncate">
                        {person === undefined ? balance.userId : fullName(person)}
                        {balance.userId === user.id && (
                          <span className="text-muted-foreground"> — это вы</span>
                        )}
                      </span>
                      <Amount value={balance.amount} tone="owes" signed />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последние события</CardTitle>
            <CardDescription>
              Взносы, заказы, отсутствия и корректировки — в порядке появления.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed events={events} people={byId} today={today} />
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Весь таймлайн</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
