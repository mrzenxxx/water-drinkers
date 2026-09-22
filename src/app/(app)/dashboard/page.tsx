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
import { DashboardFilters } from '@/components/dashboard-filters';
import { FoldCard } from '@/components/fold-card';
import { FundBalanceChart } from '@/components/charts/fund-balance-chart';
import { TimelineLanes } from '@/components/charts/timeline-lanes';
import { IconChip } from '@/components/icon-chip';
import { StatTile } from '@/components/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { addDays } from '@/lib/calc';
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
  formatMonth,
  fullName,
  monthOf,
  shiftMonth,
  withCount,
} from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { buildEvents, filterEvents, groupEvents } from '@/lib/view/events';
import { toFeedItems } from '@/lib/view/feed';
import {
  bucketKeyOf,
  dashboardQuery,
  parseDashboardFilters,
  type Granularity,
  type RawParams,
} from '@/lib/view/filters';
import { buildBalanceSeries, bucketKeys, fundDeltas } from '@/lib/view/series';
import { summarizePeriod } from '@/lib/view/summary';
import { pageTitle } from '@/lib/view/app';

/**
 * Дашборд с таймлайном (§6.9).
 *
 * Экран **только показывает**. Ни одна цифра здесь не источник истины:
 * источник — таблицы §6.3–§6.5 и инвариант §5. Поэтому всё считается из
 * тех же данных, что и балансы, и ничего не пересчитывается по-своему.
 *
 * Состояние экрана целиком в адресе: период, шаг, участники, типы событий.
 * Ссылкой можно поделиться — прямое требование §6.9.
 */

/** Следующая корзина для выбранного шага. Пара к `bucketKeyOf`. */
function nextBucket(granularity: Granularity): (key: IsoDate) => IsoDate {
  if (granularity === 'day') return (key) => addDays(key, 1);
  if (granularity === 'week') return (key) => addDays(key, 7);
  return (key) => `${shiftMonth(monthOf(key), 1)}-01`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<ReactNode> {
  await requirePageUser();

  const [params, state, source, people, byId, earliest] = await Promise.all([
    searchParams,
    fundState(),
    timelineSource(),
    listPeople(),
    peopleById(),
    earliestKnownDate(),
  ]);

  const today = todayIso();
  const filters = parseDashboardFilters(params, { today, earliest });
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
  const keys = bucketKeys(range, bucketKeyOf(filters.granularity), nextBucket(filters.granularity));
  const series = buildBalanceSeries(
    fundDeltas(allEvents),
    state.input.fund.openingBalance,
    range,
    keys,
  );

  const groups = groupEvents(visible, bucketKeyOf(filters.granularity)).reverse();

  const bucketTitle = (key: IsoDate): string => {
    if (filters.granularity === 'month') return formatMonth(monthOf(key));
    if (filters.granularity === 'week') return `Неделя с ${formatDate(key)}`;
    return formatDate(key);
  };

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Дашборд')}</title>

      <header className="flex items-start gap-3">
        <IconChip icon={ChartLine} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Как фонд жил во времени. Экран только показывает: источник истины — таблицы
            взносов, заказов и балансов.
          </p>
        </div>
      </header>

      <FoldCard title="Фильтры">
        <DashboardFilters
          key={dashboardQuery(filters)}
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
          <FundBalanceChart series={series} granularity={filters.granularity} />
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
                    {bucketTitle(group.key)} · {withCount(group.events.length, EVENTS)}
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
        {withCount(summary.personDays, PERSON_DAYS)}. Расхождение между дашбордом и
        таблицами — баг дашборда, а не повод пересчитывать балансы.
      </p>
    </div>
  );
}
