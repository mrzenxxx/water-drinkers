import Link from 'next/link';
import { CalendarOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { AbsenceCalendar } from '@/components/absence-calendar';
import { AbsenceForm } from '@/components/absence-form';
import { DeleteAbsenceButton } from '@/components/delete-absence-button';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { listAbsences, peopleById } from '@/lib/data/queries';
import {
  ABSENCE_TYPE_LABEL,
  DAYS,
  formatDateRange,
  formatMonth,
  fullName,
  monthOf,
  shiftMonth,
  startOfWeek,
  withCount,
} from '@/lib/format';
import { addDays, toEpochDay } from '@/lib/calc';
import { absencesOfMonth, buildMonthGrid } from '@/lib/view/calendar';
import type { RawParams } from '@/lib/view/filters';

/**
 * Отсутствия (§6.6).
 *
 * Календарь листается ссылками, а не состоянием: месяц лежит в адресе,
 * страница остаётся серверной, и ссылкой на конкретный месяц можно
 * поделиться. «На месяц вперёд и назад» из §6.6 — это и есть две стрелки,
 * а не жёсткое окно в три месяца.
 */
export default async function AbsencesPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<ReactNode> {
  const user = await requirePageUser();

  const params = await searchParams;
  const today = todayIso();
  const readOnly = user.restriction === 'MUTED';
  const requested = typeof params.month === 'string' ? params.month : undefined;
  const month = requested !== undefined && /^\d{4}-\d{2}$/.test(requested) ? requested : monthOf(today);

  // Сетка захватывает хвосты соседних месяцев, поэтому выборка идёт по ней,
  // а не по календарным границам месяца: иначе отпуск, начавшийся 30-го
  // числа прошлого месяца, исчез бы из первой недели.
  const grid = buildMonthGrid(month, today);
  const gridFrom = startOfWeek(grid.from);
  const gridTo = addDays(startOfWeek(grid.to), 6);

  const [absences, byId] = await Promise.all([listAbsences(gridFrom, gridTo), peopleById()]);

  const monthAbsences = absencesOfMonth(absences, grid.from, grid.to);
  const mine = monthAbsences.filter((absence) => absence.userId === user.id);

  return (
    <div className="flex flex-col gap-6">
      <title>Отсутствия — WaterDrinkers</title>

      <PageHeader icon={CalendarOff} title="Отсутствия">
        Дни, когда человека нет в офисе, не входят в его долю за воду.
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{formatMonth(month)}</CardTitle>
            <CardDescription>Календарь команды.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/absences?month=${shiftMonth(month, -1)}`}>← Назад</Link>
            </Button>
            {month !== monthOf(today) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/absences">Сегодня</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/absences?month=${shiftMonth(month, 1)}`}>Вперёд →</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AbsenceCalendar
            month={month}
            today={today}
            absences={absences}
            people={byId}
            highlightUserId={user.id}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Отметить своё отсутствие</CardTitle>
            <CardDescription>
              Обе даты включительно. Пересечение с уже отмеченными запрещено.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              <p className="text-muted-foreground text-sm">
                Отмечать отсутствия сейчас нельзя: администратор включил режим только просмотра.
              </p>
            ) : (
              <AbsenceForm today={today} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>В этом месяце</CardTitle>
            <CardDescription>
              Свои записи можно удалить — расчёт пересчитается сам.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthAbsences.length === 0 ? (
              <p className="text-muted-foreground text-sm">В этом месяце никто не отсутствует.</p>
            ) : (
              <ul className="flex flex-col">
                {monthAbsences.map((absence) => {
                  const person = byId.get(absence.userId);
                  const days = toEpochDay(absence.endsOn) - toEpochDay(absence.startsOn) + 1;
                  const isMine = absence.userId === user.id;

                  return (
                    <li
                      key={absence.id}
                      className="border-border flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {person === undefined ? absence.userId : fullName(person)}
                        </span>
                        {isMine && <span className="text-muted-foreground"> — это вы</span>}
                        <span className="text-muted-foreground block text-xs">
                          {formatDateRange(absence.startsOn, absence.endsOn)} ·{' '}
                          {withCount(days, DAYS)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">{ABSENCE_TYPE_LABEL[absence.type]}</Badge>
                        {isMine && !readOnly && <DeleteAbsenceButton id={absence.id} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {mine.length === 0 && (
              <p className="text-muted-foreground mt-3 text-xs">
                Своих отсутствий в этом месяце нет.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
