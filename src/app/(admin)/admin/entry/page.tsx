import type { ReactNode } from 'react';

import { AbsenceForParticipant, ContributionForParticipant } from '@/components/admin/entry-forms';
import { getFundState, todayIso } from '@/lib/data';
import { loadParticipants } from '@/lib/data/admin';
import { prisma } from '@/lib/db';
import { toRublesString } from '@/lib/money';

/**
 * Ввод за участника (§6.7).
 *
 * Для того, кто не может внести данные сам: заболел, в отпуске, без доступа
 * к почте. Обе записи помечаются как внесённые администратором и попадают
 * в журнал аудита с указанием, кто и за кого их создал.
 */
export default async function EntryPage(): Promise<ReactNode> {
  const [participants, state] = await Promise.all([
    loadParticipants(prisma),
    getFundState(prisma),
  ]);
  const today = todayIso();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Ввод за участника</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Взнос, внесённый администратором, сразу попадает в фонд: запись администратора и есть
          подтверждение.
        </p>
      </div>

      <ContributionForParticipant
        participants={participants}
        today={today}
        defaultContribution={toRublesString(state.input.fund.defaultContribution)}
      />

      <AbsenceForParticipant participants={participants} today={today} />
    </section>
  );
}
