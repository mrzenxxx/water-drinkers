import type { ReactNode } from 'react';

import { AdjustmentForm } from '@/components/admin/adjustment-form';
import { AuditFilters, AuditTable } from '@/components/admin/audit-log';
import { OpeningBalancesForm } from '@/components/admin/opening-balances-form';
import { isIsoDate } from '@/lib/calc';
import type { IsoDate } from '@/lib/calc/types';
import { todayIso } from '@/lib/data';
import { loadAuditLog, loadFundOverview, loadParticipants } from '@/lib/data/admin';
import { prisma } from '@/lib/db';

/**
 * Журнал и корректировки (§6.7).
 *
 * Отсюда же задаётся стартовое состояние фонда (§4.2) и вносятся корректировки
 * (§2.4) — обе операции по смыслу относятся к истории учёта, а не к составу.
 *
 * Фильтры живут в адресе страницы: состояние экрана можно переслать ссылкой.
 */

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

/** Дата из адреса, если она вообще дата. Мусор в параметре — не повод падать. */
function dateParam(params: SearchParams, key: string): IsoDate | null {
  const value = one(params, key);
  return isIsoDate(value) ? value : null;
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const query = {
    userId: one(params, 'userId'),
    action: one(params, 'action'),
    from: dateParam(params, 'from') ?? '',
    to: dateParam(params, 'to') ?? '',
  };

  const [participants, fund, rows] = await Promise.all([
    loadParticipants(prisma),
    loadFundOverview(prisma),
    loadAuditLog(prisma, {
      userId: query.userId,
      action: query.action,
      from: query.from === '' ? null : (query.from as IsoDate),
      to: query.to === '' ? null : (query.to as IsoDate),
    }),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <AdjustmentForm participants={participants} />

      <OpeningBalancesForm
        participants={participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          openingBalance: participant.openingBalance,
        }))}
        fundOpeningBalance={fund.openingBalance}
        startDate={fund.startDate}
        today={todayIso()}
      />

      <AuditFilters participants={participants} query={query} />
      <AuditTable rows={rows} />
    </section>
  );
}
