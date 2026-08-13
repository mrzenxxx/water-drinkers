import { GraphQLError } from 'graphql';

import type { MutationResolvers } from '@/graphql/generated/graphql';

/**
 * На этапе 0 мутаций нет. Возвращать выдуманную сущность вместо ответа опаснее,
 * чем честно отказать: клиент принял бы пустышку за настоящие данные.
 * Код ошибки — в extensions (§10.3), а не строкой в сообщении.
 */
function notImplemented(name: string): never {
  throw new GraphQLError(`Mutation "${name}" is not implemented yet`, {
    extensions: { code: 'NOT_IMPLEMENTED' },
  });
}

export const Mutation: MutationResolvers = {
  // Аутентификация — этап 2
  requestLoginCode: () => ({ ok: true, expiresInSeconds: 0 }),
  verifyLoginCode: () => notImplemented('verifyLoginCode'),
  logout: () => false,
  updateProfile: () => notImplemented('updateProfile'),

  // Взносы — этапы 3 и 6
  extractReceipt: () => notImplemented('extractReceipt'),
  submitContribution: () => notImplemented('submitContribution'),
  confirmContribution: () => notImplemented('confirmContribution'),
  rejectContribution: () => notImplemented('rejectContribution'),

  // Заказы — этап 3
  createWaterOrder: () => notImplemented('createWaterOrder'),

  // Отсутствия — этап 3
  addAbsence: () => notImplemented('addAbsence'),
  deleteAbsence: () => false,

  // Администрирование — этапы 3 и 4
  runMigration: () => notImplemented('runMigration'),
  addParticipant: () => notImplemented('addParticipant'),
  deactivateParticipant: () => notImplemented('deactivateParticipant'),
  settleParticipant: () => notImplemented('settleParticipant'),
  createAdjustment: () => notImplemented('createAdjustment'),

  // Помощник — этап 7
  askAssistant: () => notImplemented('askAssistant'),
};
