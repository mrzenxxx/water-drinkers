import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addDays } from '@/lib/calc';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listOrders, peopleById } from '@/lib/data/queries';
import {
  BOTTLES,
  DAYS,
  ORDERS,
  PERSON_DAYS,
  formatDate,
  fullName,
  withCount,
} from '@/lib/format';
import { formatKopecks } from '@/lib/money';

/**
 * Заказы воды (§6.5).
 *
 * У каждого заказа раскрывается распределение по участникам — те самые доли
 * §4.4, что уже посчитаны ядром. Сумма долей равна стоимости заказа до копейки
 * (метод наибольших остатков, §4.6); это видно прямо в раскрытии, и потому
 * не требует веры на слово.
 */
export default async function OrdersPage(): Promise<ReactNode> {
  const currentUser = await requirePageUser();

  const [orders, state, byId] = await Promise.all([listOrders(), fundState(), peopleById()]);
  const today = todayIso();

  const total = orders.reduce((sum, order) => sum + order.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <title>Заказы воды — WaterDrinkers</title>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Заказы воды</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Вода, купленная в день заказа, выпивается до следующей закупки — по этому
          периоду и раскладывается её стоимость.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{withCount(orders.length, ORDERS)}</CardTitle>
          <CardDescription>
            Всего закуплено на <Amount value={total} />.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Заказов ещё не было.</p>
          ) : (
            <ul className="flex flex-col">
              {orders.map((order) => {
                const period = state.periodOf(order.id);
                const creator = byId.get(order.createdBy);

                return (
                  <li key={order.id} className="border-border border-b last:border-b-0">
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-3">
                        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="tabular font-medium">
                            {formatDate(order.orderedAt)}
                          </span>
                          {order.bottlesCount !== null && (
                            <span className="text-muted-foreground">
                              {withCount(order.bottlesCount, BOTTLES)}
                            </span>
                          )}
                          {order.supplier !== null && (
                            <span className="text-muted-foreground">· {order.supplier}</span>
                          )}
                          {period?.isOpen === true && (
                            <Badge variant="secondary">Период идёт</Badge>
                          )}
                          {period?.isDegenerate === true && (
                            <Badge variant="destructive">Поровну: все отсутствовали</Badge>
                          )}
                        </span>
                        <Amount value={order.amount} className="font-medium" />
                      </summary>

                      <div className="space-y-3 pb-4 text-sm">
                        <p className="text-muted-foreground">
                          {period === null ? (
                            <>Заказ вне расчёта: он лежит до даты начала учёта (§4.2).</>
                          ) : (
                            <>
                              {/*
                                Период хранится полуоткрытым `[from, to)` (§4.3);
                                человеку показывается последний включённый день,
                                иначе дата следующей закупки читалась бы как день,
                                оплаченный дважды.
                              */}
                              Период потребления: {formatDate(period.period.from)} —{' '}
                              {formatDate(addDays(period.period.to, -1))}
                              {period.isOpen && <> (открыт, идёт по сегодня, {formatDate(today)})</>}
                              , {withCount(period.totalPersonDays, PERSON_DAYS)}.
                            </>
                          )}
                          {order.note !== null && <> Примечание: {order.note}.</>}{' '}
                          Оформил {creator === undefined ? '—' : fullName(creator)}.
                        </p>

                        {period !== null && period.shares.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground text-left">
                                  <th className="py-1 pr-4 font-medium">Участник</th>
                                  <th className="py-1 pr-4 text-right font-medium">
                                    Дней присутствия
                                  </th>
                                  <th className="py-1 text-right font-medium">Доля</th>
                                </tr>
                              </thead>
                              <tbody>
                                {period.shares.map((share) => {
                                  const person = byId.get(share.userId);
                                  return (
                                    <tr key={share.userId} className="border-border border-t">
                                      <td className="py-1 pr-4">
                                        {person === undefined ? share.userId : fullName(person)}
                                        {share.userId === currentUser.id && (
                                          <span className="text-muted-foreground"> — это вы</span>
                                        )}
                                      </td>
                                      <td className="tabular py-1 pr-4 text-right">
                                        {withCount(share.daysPresent, DAYS)}
                                      </td>
                                      <td className="py-1 text-right">
                                        <Amount value={share.share} />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-border border-t font-medium">
                                  <td className="py-1 pr-4">Сумма долей</td>
                                  <td className="tabular py-1 pr-4 text-right">
                                    {withCount(period.totalPersonDays, PERSON_DAYS)}
                                  </td>
                                  <td className="py-1 text-right">
                                    {formatKopecks(
                                      period.shares.reduce((sum, share) => sum + share.share, 0),
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
