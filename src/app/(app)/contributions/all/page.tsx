import { Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { ContributionFilters } from '@/components/contribution-filters';
import { ContributionsList } from '@/components/contributions-list';
import { FoldCard } from '@/components/fold-card';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { isCountedStatus } from '@/lib/calc';
import { listContributions, listPeople, peopleById } from '@/lib/data/queries';
import { CONTRIBUTIONS, fullName, withCount } from '@/lib/format';
import { pageTitle } from '@/lib/view/app';
import { parseContributionFilters, type RawParams } from '@/lib/view/filters';

/**
 * Все взносы (§6.3).
 *
 * Отбор — та же панель, что у статистики: применяется сразу, без кнопки,
 * а состояние экрана целиком в адресе — ссылкой на отфильтрованную таблицу
 * можно поделиться. Разбор и сборка адреса — чистые функции с тестами.
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
    .filter((row) => isCountedStatus(row.status))
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Все взносы')}</title>

      <PageHeader icon={Users} title="Все взносы">
        Приложение прозрачно: участник видит то же, что администратор.
      </PageHeader>

      {/*
        Отбор прилипает под шапкой, как фильтры статистики: список взносов
        длинный, и менять участника или статус удобно, не прокручивая назад.
        Только на широком экране — на телефоне липкая панель закрыла бы
        почти весь экран; свернуть её можно всегда. Стекло плотнее обычного
        (`glass-strong`): панель ездит поверх списка.
      */}
      <FoldCard
        title="Отбор"
        meta="Фильтры попадают в адрес — ссылкой можно поделиться"
        className="glass-strong md:sticky md:top-[4.75rem] md:z-30"
      >
        <ContributionFilters
          filters={filters}
          people={people.map((person) => ({ id: person.id, name: fullName(person) }))}
        />
      </FoldCard>

      <Card>
        <CardHeader>
          <CardTitle>
            {withCount(rows.length, CONTRIBUTIONS)}
          </CardTitle>
          <CardDescription>
            Учтено в фонде на сумму <Amount value={confirmedTotal} />. Неподтверждённые взносы
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
