import { GraphQLError } from 'graphql';

import type { GraphQLContext } from '@/graphql/context';
import type { UserResolvers } from '@/graphql/generated/graphql';

/**
 * Поля `User`, которых нет в строке таблицы.
 *
 * Скалярные поля отдаёт маппер напрямую; здесь только вычисляемое и связи.
 * Связи и баланс появляются на этапе 3 — до тех пор честный отказ вместо
 * пустого массива: пустой список взносов выглядел бы как «человек не сдавал».
 */
function notImplemented(field: string): never {
  throw new GraphQLError(`User.${field} arrives in stage 3`, {
    extensions: { code: 'NOT_IMPLEMENTED' },
  });
}

export const User: UserResolvers<GraphQLContext> = {
  /** Участник числится в составе, если не отмечена дата выхода. */
  isActive: (parent) => parent.leftAt === null,

  // Даты в базе — DATE без времени; наружу отдаём YYYY-MM-DD.
  joinedAt: (parent) => toDateString(parent.joinedAt),
  leftAt: (parent) => (parent.leftAt === null ? null : toDateString(parent.leftAt)),

  openingBalance: (parent) => Number(parent.openingBalance),

  balance: () => notImplemented('balance'),
  absences: () => notImplemented('absences'),
  contributions: () => notImplemented('contributions'),
};

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}
