import Link from 'next/link';
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { ContributionsList } from '@/components/contributions-list';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requirePageUser } from '@/lib/auth/current-user';
import { listContributions, listPeople, peopleById } from '@/lib/data/queries';
import { CONTRIBUTION_STATUS_LABEL, CONTRIBUTIONS, fullName, withCount } from '@/lib/format';
import {
  hasContributionFilters,
  parseContributionFilters,
  type RawParams,
} from '@/lib/view/filters';

/**
 * Все взносы (§6.3).
 *
 * Отбор — обычная `<form method="get">`: состояние экрана целиком в адресе,
 * ссылкой на отфильтрованную таблицу можно поделиться, и клиентский компонент
 * для этого не нужен вовсе. Разбор адреса — чистая функция с тестами.
 */
export default async function AllContributionsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<ReactNode> {
  await requirePageUser();

  const filters = parseContributionFilters(await searchParams);

  const [people, byId, rows] = await Promise.all([
    listPeople(),
    peopleById(),
    listContributions({
      ...(filters.userId !== null ? { userId: filters.userId } : {}),
      ...(filters.status !== null ? { status: filters.status } : {}),
      ...(filters.from !== null ? { from: filters.from } : {}),
      ...(filters.to !== null ? { to: filters.to } : {}),
    }),
  ]);

  const confirmedTotal = rows
    .filter((row) => row.status === 'CONFIRMED')
    .reduce((sum, row) => sum + row.amount, 0);

  const fieldClass =
    'field-surface focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm transition-[color,box-shadow,border-color] focus-visible:ring-2 focus-visible:outline-none';

  return (
    <div className="flex flex-col gap-6">
      <title>Все взносы — WaterDrinkers</title>

      <PageHeader icon={Users} title="Все взносы">
        Приложение прозрачно: участник видит то же, что администратор.
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Отбор</CardTitle>
          <CardDescription>Фильтры попадают в адрес — ссылкой можно поделиться.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="user">Участник</Label>
              <select
                id="user"
                name="user"
                defaultValue={filters.userId ?? ''}
                className={fieldClass}
              >
                <option value="">Все</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {fullName(person)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? ''}
                className={fieldClass}
              >
                <option value="">Любой</option>
                {(['PENDING', 'CONFIRMED', 'REJECTED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {CONTRIBUTION_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">Платёж с</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.from ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">по</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.to ?? ''} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Показать</Button>
              {hasContributionFilters(filters) && (
                <Button asChild variant="ghost">
                  <Link href="/contributions/all">Сбросить</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {withCount(rows.length, CONTRIBUTIONS)}
          </CardTitle>
          <CardDescription>
            Подтверждено на сумму <Amount value={confirmedTotal} />. Неподтверждённые взносы
            в фонд ещё не попали.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionsList
            rows={rows}
            people={byId}
            showPerson
            emptyText="Под фильтр ничего не подошло."
          />
        </CardContent>
      </Card>
    </div>
  );
}
