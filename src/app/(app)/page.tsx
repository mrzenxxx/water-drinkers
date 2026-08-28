import { Droplets, Megaphone, TrendingDown, Users, Waves } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ActivityFeed } from '@/components/activity-feed';
import { Amount, HeroAmount } from '@/components/amount';
import { IconChip } from '@/components/icon-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listAnnouncements, listPeople, peopleById, timelineSource } from '@/lib/data/queries';
import { fullName } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { isUnread, summarize } from '@/lib/view/announcements';
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

/**
 * Сколько непрочитанных объявлений показывать на главной. Дальше — раздел.
 * Больше двух карточек отжали бы вниз то, ради чего сюда заходят: баланс.
 */
const NOTICE_LIMIT = 2;

export default async function HomePage(): Promise<ReactNode> {
  const user = await requirePageUser();

  const [state, people, byId, source, announcements] = await Promise.all([
    fundState(),
    listPeople(),
    peopleById(),
    timelineSource(),
    listAnnouncements(),
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

  /**
   * Непрочитанные объявления (§6.12) — отдельным блоком **над** лентой, а не
   * внутри неё. В ленте живут события фонда, у каждого из которых есть сумма
   * и место в расчёте; у объявления нет ни того, ни другого, и шестой тип
   * события потребовал бы шестого цвета в палитре, где пять уже на пределе
   * различимости. Здесь оно рядом с лентой, но само по себе.
   *
   * Отметку «прочитано» ставит только раздел: погаси её главная — человек
   * увидел бы заголовок и никогда не прочёл бы текст.
   */
  const seenAt = user.announcementsSeenAt?.toISOString() ?? null;
  const unreadAll = announcements.filter((item) => isUnread(item, seenAt));
  const unread = unreadAll.slice(0, NOTICE_LIMIT);

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Ваш баланс</CardDescription>
                <CardTitle className="mt-1">
                  <HeroAmount value={amount} tone="auto" signed />
                </CardTitle>
              </div>
              <IconChip icon={owes ? TrendingDown : Waves} tone={owes ? 'owes' : 'water'} />
            </div>
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Остаток фонда</CardDescription>
                <CardTitle className="mt-1">
                  <HeroAmount value={state.result.fundBalance} tone="neutral" />
                </CardTitle>
              </div>
              <IconChip icon={Droplets} />
            </div>
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

      {unread.length > 0 && (
        <Card className="border-primary/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconChip icon={Megaphone} size="sm" />
              <CardTitle>Новое от администратора</CardTitle>
            </div>
            <CardDescription>
              Непрочитанных объявлений: {unreadAll.length}. Полный текст — в разделе «Объявления».
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {unread.map((item) => (
                <li key={item.id} className="border-border border-b py-2 last:border-b-0">
                  <Link
                    href="/notices"
                    className="focus-visible:ring-ring block rounded-md focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {summarize(item.body, 120)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/notices">Читать объявления</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        `items-start`: карточки тянутся по своему содержимому, а не по соседке.
        Очередь должников почти всегда короче ленты событий, и без этого рядом
        с одной фамилией повисало полэкрана пустого стекла.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconChip icon={Users} size="sm" tone={debtors.length === 0 ? 'water' : 'owes'} />
              <CardTitle>Кто в минусе</CardTitle>
            </div>
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
            <div className="flex items-center gap-3">
              <IconChip icon={Waves} size="sm" />
              <CardTitle>Последние события</CardTitle>
            </div>
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
