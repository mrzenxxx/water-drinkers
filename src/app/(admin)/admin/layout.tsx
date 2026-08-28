import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminNav } from '@/components/admin/admin-nav';
import { IconChip } from '@/components/icon-chip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requirePageAdmin } from '@/lib/auth/current-user';
import { loadFundOverview } from '@/lib/data/admin';
import { prisma } from '@/lib/db';
import { formatKopecks } from '@/lib/money';

/**
 * Оболочка админ-панели (§6.7): проверка роли и вкладки раздела.
 *
 * Право входа проверяется здесь, в одном месте на весь раздел. Оставлять
 * проверку каждой странице значит однажды завести новую и забыть её добавить;
 * `requirePageAdmin` уводит гостя на вход, а участника — на главную.
 *
 * Здесь же висит баннер о расхождении инварианта §5: спецификация требует
 * показывать его администратору, и логичнее всего — над любым его экраном.
 */
/**
 * Раздел не кешируется и не пререндерится.
 *
 * Каждая страница здесь зависит от сессии и от текущего состояния базы, и
 * попытка собрать её заранее означала бы либо чужие данные в кеше, либо запрос
 * к базе во время `next build`, где ни базы, ни переменных окружения нет.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  await requirePageAdmin();
  const fund = await loadFundOverview(prisma);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:py-10">
      <title>Админ-панель — WaterDrinkers</title>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconChip icon={ShieldCheck} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Админ-панель</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              В фонде <span className="tabular font-medium">{formatKopecks(fund.balance)}</span>
              {fund.startDate === null ? '' : `, учёт с ${fund.startDate}`}
            </p>
          </div>
        </div>
        <Link href="/" className="text-primary text-sm underline underline-offset-4">
          К общим экранам
        </Link>
      </header>

      {!fund.isConsistent && (
        <Alert variant="destructive">
          <AlertTitle>Инвариант нарушен — это баг в коде, а не в данных</AlertTitle>
          <AlertDescription>
            Сумма балансов {formatKopecks(fund.balancesSum)} не сходится с остатком фонда{' '}
            {formatKopecks(fund.balance)}. Расхождение{' '}
            {formatKopecks(fund.difference, { alwaysSign: true })}. Вносить операции до выяснения
            не стоит: они лягут поверх ошибки.
          </AlertDescription>
        </Alert>
      )}

      <AdminNav />

      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
