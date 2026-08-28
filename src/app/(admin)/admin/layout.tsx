import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { IconChip } from '@/components/icon-chip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requirePageAdmin } from '@/lib/auth/current-user';
import { loadFundOverview } from '@/lib/data/admin';
import { countUnreadAnnouncements, fundState } from '@/lib/data/queries';
import { prisma } from '@/lib/db';
import { formatKopecks } from '@/lib/money';

/**
 * Оболочка админ-панели (§6.7): проверка роли и предупреждение об инварианте.
 *
 * Право входа проверяется здесь, в одном месте на весь раздел. Оставлять
 * проверку каждой странице значит однажды завести новую и забыть её добавить;
 * `requirePageAdmin` уводит гостя на вход, а участника — на главную.
 *
 * Панель живёт внутри той же оболочки, что и экраны участника: раньше вход
 * сюда означал потерю навигации целиком — ни разделов, ни возврата, кроме
 * одной ссылки в углу. Свои вкладки у панели остались, но рисует их общий
 * механизм разделов (`ADMIN_SECTION` в `lib/view/nav.ts`), а не второй,
 * похожий на первый.
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
  const user = await requirePageAdmin();

  // Пересчёт фонда мемоизирован `cache()`: и обзор, и цифры шапки, и сами
  // страницы панели читают одно и то же состояние за один запрос к базе.
  const [fund, state, unreadNotices] = await Promise.all([
    loadFundOverview(prisma),
    fundState(),
    countUnreadAnnouncements(user.announcementsSeenAt?.toISOString() ?? null),
  ]);

  return (
    <AppShell
      user={user}
      unreadNotices={unreadNotices}
      balance={state.balanceOf(user.id)?.amount ?? 0}
      fundBalance={state.result.fundBalance}
    >
      <title>Админ-панель — WaterDrinkers</title>

      <header className="flex items-start gap-3">
        <IconChip icon={ShieldCheck} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Админ-панель</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            В фонде <span className="tabular font-medium">{formatKopecks(fund.balance)}</span>
            {fund.startDate === null ? '' : `, учёт с ${fund.startDate}`}
          </p>
        </div>
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

      <div className="flex flex-col gap-6">{children}</div>
    </AppShell>
  );
}
