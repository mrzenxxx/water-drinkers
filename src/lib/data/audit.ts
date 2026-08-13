/**
 * Журнал аудита (`audit_log`, §11): кто, что и когда изменил.
 *
 * Пишется каждой изменяющей мутацией и обязательно **внутри той же транзакции**,
 * что и само изменение. Запись «мимо» транзакции в половине случаев переживёт
 * откат и станет свидетельством о действии, которого не было.
 *
 * `before` и `after` хранят снимок значимых полей, а не строку целиком:
 * §6.7 обещает читаемую историю, а не дамп таблицы.
 */

import type { Prisma, PrismaClient } from '@/generated/prisma/client';

/** Prisma-клиент или клиент внутри `$transaction` — писать можно и туда, и туда. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/** Действия, которые пишет этап 3. Этапы 4 и далее дополняют список. */
export type AuditAction =
  | 'contribution.submit'
  | 'contribution.confirm'
  | 'contribution.reject'
  | 'order.create'
  | 'absence.add'
  | 'absence.delete';

export type AuditRecord = {
  /** Кто действовал. `null` — системное действие (сидов, миграции). */
  actorId: string | null;
  action: AuditAction;
  /** Таблица или доменная сущность: `contribution`, `water_order`, `absence`. */
  entity: string;
  entityId: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function writeAudit(db: DbClient, record: AuditRecord): Promise<void> {
  await db.auditEntry.create({
    data: {
      actorId: record.actorId,
      action: record.action,
      entity: record.entity,
      entityId: record.entityId,
      before: record.before,
      after: record.after,
    },
  });
}
