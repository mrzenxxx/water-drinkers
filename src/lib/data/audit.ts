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

/**
 * Действия, которые пишут этапы 3 и 4. Список закрытый: свободная строка
 * рано или поздно разъезжается с фильтром журнала (§6.7).
 *
 * Ввод за участника — отдельные действия (`*.for`), а не флаг внутри `after`:
 * §6.7 требует видеть в журнале, кто и за кого создал запись, а фильтр по типу
 * действия должен уметь показать ровно эти случаи.
 */
export type AuditAction =
  | 'contribution.submit'
  | 'contribution.confirm'
  | 'contribution.reject'
  | 'contribution.submit.for'
  | 'order.create'
  | 'absence.add'
  | 'absence.delete'
  | 'absence.add.for'
  | 'participant.add'
  | 'participant.deactivate'
  | 'participant.reactivate'
  | 'participant.role'
  | 'participant.update'
  | 'participant.credentials'
  | 'participant.restriction'
  | 'participant.settle'
  | 'fund.adjust'
  | 'fund.opening'
  | 'announcement.create'
  | 'announcement.update'
  | 'announcement.archive'
  | 'announcement.restore'
  | 'announcement.image'
  | 'receipt.upload';

/** Подписи действий по-русски — журнал §6.7 читают люди, а не машины. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'contribution.submit': 'Взнос подан',
  'contribution.confirm': 'Взнос подтверждён',
  'contribution.reject': 'Взнос отклонён',
  'contribution.submit.for': 'Взнос внесён за участника',
  'order.create': 'Заказ воды',
  'absence.add': 'Отсутствие добавлено',
  'absence.delete': 'Отсутствие удалено',
  'absence.add.for': 'Отсутствие внесено за участника',
  'participant.add': 'Участник добавлен',
  'participant.deactivate': 'Участник исключён',
  'participant.reactivate': 'Участник возвращён',
  'participant.role': 'Смена роли',
  'participant.update': 'Данные участника изменены',
  'participant.credentials': 'Выданы учётные данные',
  'participant.restriction': 'Смена ограничения',
  'participant.settle': 'Выплата остатка',
  'fund.adjust': 'Корректировка',
  'fund.opening': 'Стартовое состояние фонда',
  'announcement.create': 'Объявление создано',
  'announcement.update': 'Объявление изменено',
  'announcement.archive': 'Объявление убрано в архив',
  'announcement.restore': 'Объявление возвращено из архива',
  'announcement.image': 'Картинка объявления',
  'receipt.upload': 'Чек загружен',
};

/** Все известные действия — для выпадающего фильтра журнала. */
export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

/** Подпись действия; неизвестное показываем как есть, а не прячем. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

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
