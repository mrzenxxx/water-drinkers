import type { GraphQLContext } from '@/graphql/context';
import { notImplemented } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';

/**
 * Администрирование состава и денег — этап 4, админ-панель §6.7.
 *
 * Файл заведён пустым намеренно: этап 4 добавляет реализации сюда, не трогая
 * ни взносы, ни заказы, ни отсутствия. Заглушки честно отказывают, а не
 * возвращают выдуманную сущность — притворяющаяся рабочей заглушка дороже
 * в отладке, чем отсутствующая.
 *
 * Что понадобится этим мутациям из уже готового:
 *  * `ctx.fundState()` — балансы и остаток фонда для `settleParticipant`;
 *  * `checkOpeningInvariant` из `@/lib/calc` — проверка §4.2 перед сохранением
 *    начальных сальдо;
 *  * `writeAudit` из `@/lib/data` — обязательная запись в журнал, в той же
 *    транзакции, что и само изменение;
 *  * `ctx.invalidateFundState()` — после любой записи, меняющей деньги.
 */
export const adminMutations: Pick<
  MutationResolvers<GraphQLContext>,
  | 'setOpeningBalances'
  | 'addParticipant'
  | 'deactivateParticipant'
  | 'settleParticipant'
  | 'createAdjustment'
> = {
  setOpeningBalances: () => notImplemented('setOpeningBalances'),
  addParticipant: () => notImplemented('addParticipant'),
  deactivateParticipant: () => notImplemented('deactivateParticipant'),
  settleParticipant: () => notImplemented('settleParticipant'),
  createAdjustment: () => notImplemented('createAdjustment'),
};
