import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import { badInput, forbidden, graphqlError, isExclusionViolation, requireDate } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { compareDates } from '@/lib/calc';
import { fromIsoDate, writeAudit } from '@/lib/data';

/**
 * Отсутствия: отпуск и больничный (§4.1, §6.6).
 *
 * Свои даты каждый заводит сам. Ввод за участника — работа администратора
 * из §6.7 и относится к этапу 4.
 *
 * Пересечения запрещены базой (`EXCLUDE USING gist`, §11) — и это правильное
 * место для такого правила: обойти его прямой записью нельзя. Но голая ошибка
 * драйвера доезжает до клиента пятисоткой, поэтому пересечение сначала ищется
 * запросом (ради внятного сообщения с конкретными датами), а исключение базы
 * ловится вторым рубежом — на случай гонки двух одновременных запросов.
 */

function overlapError(startsOn: string, endsOn: string): ReturnType<typeof graphqlError> {
  return graphqlError(
    `Отсутствие с ${startsOn} по ${endsOn} пересекается с уже отмеченным. ` +
      'Нельзя быть одновременно в отпуске и на больничном.',
    'ABSENCE_OVERLAP',
    { startsOn, endsOn },
  );
}

export const absenceMutations: Pick<MutationResolvers<GraphQLContext>, 'addAbsence' | 'deleteAbsence'> = {
  addAbsence: async (_parent, { type, startsOn, endsOn, note }, ctx) => {
    const user = await requireUser(ctx);

    const from = requireDate(startsOn, 'startsOn');
    const to = requireDate(endsOn, 'endsOn');
    // Обе границы включительные (§11), поэтому отсутствие «на один день» — это
    // startsOn == endsOn, а не пустой интервал.
    if (compareDates(to, from) < 0) {
      throw badInput('Дата окончания не может быть раньше даты начала.', { field: 'endsOn' });
    }

    const overlapping = await ctx.db.absence.findFirst({
      where: {
        userId: user.id,
        startsOn: { lte: fromIsoDate(to) },
        endsOn: { gte: fromIsoDate(from) },
      },
    });
    if (overlapping !== null) {
      throw overlapError(from, to);
    }

    try {
      const created = await ctx.db.$transaction(async (tx) => {
        const row = await tx.absence.create({
          data: {
            userId: user.id,
            type,
            startsOn: fromIsoDate(from),
            endsOn: fromIsoDate(to),
            note: note?.trim() || null,
          },
        });

        await writeAudit(tx, {
          actorId: user.id,
          action: 'absence.add',
          entity: 'absence',
          entityId: row.id,
          after: { type, startsOn: from, endsOn: to },
        });

        return row;
      });

      ctx.invalidateFundState();
      return created;
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw overlapError(from, to);
      }
      throw error;
    }
  },

  /**
   * Удаление отсутствия — не операция с деньгами, поэтому строку из таблицы
   * действительно удаляем: неизменяем журнал `fund_transactions` (правило 4),
   * а не календарь. Балансы после этого пересчитываются сами — дни присутствия
   * выводятся из текущего состояния, а не хранятся.
   */
  deleteAbsence: async (_parent, { id }, ctx) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db.absence.findUnique({ where: { id } });
    // Повторный вызов не ошибка: кнопку нажали дважды — результат тот же.
    if (existing === null) return false;

    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      throw forbidden('Можно удалить только своё отсутствие.');
    }

    await ctx.db.$transaction(async (tx) => {
      await tx.absence.delete({ where: { id } });
      await writeAudit(tx, {
        actorId: user.id,
        action: 'absence.delete',
        entity: 'absence',
        entityId: id,
        before: {
          userId: existing.userId,
          type: existing.type,
          startsOn: existing.startsOn.toISOString(),
          endsOn: existing.endsOn.toISOString(),
        },
      });
    });

    ctx.invalidateFundState();
    return true;
  },
};
