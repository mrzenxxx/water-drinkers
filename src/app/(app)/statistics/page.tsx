import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  ChartLine,
  Clock,
  Coins,
  Package,
  Scale,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { ActivityFeed } from '@/components/activity-feed';
import { Amount } from '@/components/amount';
import { StatisticsFilters } from '@/components/statistics-filters';
import { FoldCard } from '@/components/fold-card';
import { FundBalanceChart } from '@/components/charts/fund-balance-chart';
import { ParticipantBalanceChart } from '@/components/charts/participant-balance-chart';
import { TimelineLanes } from '@/components/charts/timeline-lanes';
import { IconChip } from '@/components/icon-chip';
import { StatTile } from '@/components/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import type { IsoDate } from '@/lib/calc/types';
import { todayIso } from '@/lib/data';
import { earliestKnownDate, fundState, listPeople, peopleById, timelineSource } from '@/lib/data/queries';
import {
  DAYS,
  EVENTS,
  ORDERS,
  PERSON_DAYS,
  formatDate,
  formatDateRange,
  fullName,
  withCount,
} from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { buildEvents, filterEvents, groupEvents } from '@/lib/view/events';
import { toFeedItems } from '@/lib/view/feed';
import {
  bucketKeyOf,
  bucketTitle,
  nextBucketKey,
  parseStatisticsFilters,
  type RawParams,
} from '@/lib/view/filters';
import {
  buildBalanceSeries,
  bucketKeys,
  bucketMovements,
  fundDeltas,
  participantBalanceSeries,
} from '@/lib/view/series';
import { summarizePeriod } from '@/lib/view/summary';
import { pageTitle } from '@/lib/view/app';

/**
 * Статистика с таймлайном (§6.9).
 *
 * Экран **только показывает**. Ни одна цифра здесь не источник истины:
 * источник — таблицы §6.3–§6.5 и инвариант §5. Поэтому всё считается из
 * тех же данных, что и балансы, и ничего не пересчитывается по-своему.
 *
 * Состояние экрана целиком в адресе: период, шаг, участники, типы событий.
 * Ссылкой можно поделиться — прямое требование §6.9.
 */

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<ReactNode> {
  const currentUser = await requirePageUser();

  const [params, state, source, people, byId, earliest] = await Promise.all([
    searchParams,
    fundState(),
    timelineSource(),
    listPeople(),
    peopleById(),
    earliestKnownDate(),
  ]);

  const today = todayIso();
  const filters = parseStatisticsFilters(params, { today, earliest });
  const range = { from: filters.from, to: filters.to };

  const allEvents = buildEvents(source);
  const visible = filterEvents(allEvents, {
    from: filters.from,
    to: filters.to,
    kinds: filters.kinds,
    userIds: filters.userIds,
  });

  // Человеко-дни считаются по тем участникам, кого выбрал фильтр.
  const selected = new Set(filters.userIds);
  const participants =
    selected.size === 0
      ? state.input.participants
      : state.input.participants.filter((person) => selected.has(person.id));

  const summary = summarizePeriod({
    events: visible,
    participants,
    absences: state.input.absences,
    range,
  });

  /*
    График остатка строится по **всем** денежным событиям, а не по отфильтрованным:
    остаток фонда — величина общая, и «остаток по взносам двух участников» был бы
    числом, которого в кассе нет. Фильтры типов и участников задают ленту; периоду
    подчиняются оба.
  */
  const keys = bucketKeys(range, bucketKeyOf(filters.granularity), nextBucketKey(filters.granularity));
  const series = buildBalanceSeries(
    fundDeltas(allEvents),
    state.input.fund.openingBalance,
    range,
    keys,
  );

  /*
    Балансы участников — только выбранных в фильтре: линии на всех сразу
    слились бы в пучок. Ряд считается ядром на конец каждого шага, поэтому
    последняя точка — текущий баланс (`participantBalanceSeries`).
  */
  const participantSeries = participantBalanceSeries(state.input, filters.userIds, range, keys);

  const groups = groupEvents(visible, bucketKeyOf(filters.granularity)).reverse();

  const titleOf = (key: IsoDate): string => bucketTitle(key, filters.granularity);

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Статистика')}</title>

      <header className="flex items-start gap-3">
        <IconChip icon={ChartLine} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Статистика</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Как фонд жил во времени
          </p>
        </div>
      </header>

      <FoldCard title="Фильтры">
        <StatisticsFilters
          filters={filters}
          people={people.map((person) => ({ id: person.id, name: fullName(person) }))}
        />
      </FoldCard>

      <FoldCard
        title="Сводка за период"
        meta={`${formatDateRange(range.from, range.to)} · ${withCount(summary.days, DAYS)}`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Поступило"
            icon={ArrowDownToLine}
            value={formatKopecks(summary.received)}
            tone="credit"
            hint="Подтверждённые взносы и положительные корректировки"
          />
          <StatTile
            label="Потрачено"
            icon={ArrowUpFromLine}
            value={formatKopecks(summary.spent)}
            tone="owes"
            hint="Заказы, выплаты и отрицательные корректировки"
          />
          <StatTile
            label="Изменение остатка"
            icon={Scale}
            value={<Amount value={summary.netChange} tone="auto" signed />}
            hint="Поступило минус потрачено"
          />
          <StatTile
            label="Средний расход в день"
            icon={CalendarDays}
            value={formatKopecks(summary.averageDailySpend)}
            hint="Справочная величина: потрачено, делённое на длину периода"
          />
          <StatTile label="Заказов" icon={Package} value={String(summary.orderCount)} />
          <StatTile
            label="Человеко-дней"
            icon={Users}
            value={String(summary.personDays)}
            hint="Дни присутствия всех участников за период"
          />
          <StatTile
            label="Самый дорогой заказ"
            icon={Coins}
            value={
              summary.largestOrder === null ? '—' : formatKopecks(summary.largestOrder.amount)
            }
            hint={
              summary.largestOrder === null
                ? 'Заказов за период не было'
                : formatDate(summary.largestOrder.date)
            }
          />
          <StatTile
            label="Дольше всего без закупок"
            icon={Clock}
            value={
              summary.longestGap === null ? '—' : withCount(summary.longestGap.days, DAYS)
            }
            hint={
              summary.longestGap === null
                ? undefined
                : formatDateRange(summary.longestGap.from, summary.longestGap.to)
            }
          />
        </div>
      </FoldCard>

      <Card>
        <CardHeader>
          <CardTitle>Таймлайн</CardTitle>
          <CardDescription>
            Дорожка на каждый тип события. Отсутствия — полосы: у них есть длительность.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimelineLanes
            events={visible}
            kinds={filters.kinds}
            window={range}
            people={byId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Остаток фонда</CardTitle>
          <CardDescription>
            Ступени вниз на заказах, вверх на взносах. График строится по всем движениям
            денег — фильтры участников и типов на него не влияют: остаток кассы один
            на всех.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FundBalanceChart
            series={series}
            granularity={filters.granularity}
            steps={bucketMovements(allEvents, range, keys).map((events, index) => ({
              title: titleOf(keys[index]!),
              events,
            }))}
            people={byId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Балансы участников</CardTitle>
          <CardDescription>
            Линии участников, выбранных в фильтре, на одной шкале: кто когда вносил и как
            на нём сказались заказы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ParticipantBalanceChart
            series={participantSeries}
            lines={participantSeries.map((line) => {
              const person = byId.get(line.userId);
              return {
                userId: line.userId,
                name: person === undefined ? line.userId : fullName(person),
                department: person?.department ?? null,
                isMe: line.userId === currentUser.id,
              };
            })}
            granularity={filters.granularity}
            titles={keys.map(titleOf)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>События</CardTitle>
          <CardDescription>
            Те же события списком, сгруппированные по выбранному шагу: значение
            никогда не спрятано в подсказку графика.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">За период событий нет.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key}>
                  <h3 className="text-muted-foreground mb-1 text-xs font-medium">
                    {titleOf(group.key)} · {withCount(group.events.length, EVENTS)}
                  </h3>
                  <ActivityFeed items={toFeedItems(group.events)} people={byId} today={today} />
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Заказов за период: {withCount(summary.orderCount, ORDERS)}. Человеко-дней:{' '}
        {withCount(summary.personDays, PERSON_DAYS)}. Расхождение между статистикой и
        таблицами — баг статистики, а не повод пересчитывать балансы.
      </p>
    </div>
  );
}
