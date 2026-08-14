import type { ReactNode } from 'react';

import { QueueList } from '@/components/admin/queue-list';
import { loadQueue } from '@/lib/data/admin';
import { prisma } from '@/lib/db';

/**
 * Очередь подтверждений (§6.7).
 *
 * Серверный компонент читает слой данных напрямую — без HTTP к собственному
 * `/api/graphql` (CLAUDE.md, §12а) и без `useEffect` на монтировании.
 */
export default async function QueuePage(): Promise<ReactNode> {
  const items = await loadQueue(prisma);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Очередь подтверждений</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {items.length === 0
            ? 'Взносов на рассмотрении нет.'
            : `Взносов на рассмотрении: ${items.length}. Сомнительные — сверху.`}{' '}
          Взнос влияет на баланс только после подтверждения.
        </p>
      </div>

      <QueueList items={items} />
    </section>
  );
}
