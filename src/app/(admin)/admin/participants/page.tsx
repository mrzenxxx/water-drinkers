import Link from 'next/link';
import type { ReactNode } from 'react';

import { AddParticipantForm } from '@/components/admin/add-participant-form';
import { ParticipantsTable } from '@/components/admin/participants-table';
import { authConfigFromEnv } from '@/lib/auth';
import { loadParticipants } from '@/lib/data/admin';
import { todayIso } from '@/lib/data';
import { prisma } from '@/lib/db';

/**
 * Состав участников (§6.7): добавить, исключить, вернуть, выплатить остаток,
 * назначить или снять администратора.
 *
 * Начальное сальдо задаётся при заведении участника, а меняется — на вкладке
 * «Журнал», формой стартового состояния. Отдельная правка сальдо одного
 * человека сдвинула бы `Σ балансов`, не сдвинув фонд, и сломала бы инвариант §5:
 * эти два числа правятся только вместе (§4.2).
 */
export default async function ParticipantsPage(): Promise<ReactNode> {
  const [participants, today] = [await loadParticipants(prisma), todayIso()];
  const { allowedDomain } = authConfigFromEnv();

  const active = participants.filter((participant) => participant.isActive).length;

  return (
    <section className="flex flex-col gap-6">
      <AddParticipantForm today={today} domain={allowedDomain} />

      <div>
        <h2 className="text-lg font-semibold">Состав</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          В составе {active} из {participants.length}. Начальные сальдо правятся вместе с фондом —{' '}
          <Link href="/admin/journal" className="text-primary underline underline-offset-4">
            на вкладке «Журнал»
          </Link>
          .
        </p>
      </div>

      <ParticipantsTable participants={participants} today={today} />
    </section>
  );
}
