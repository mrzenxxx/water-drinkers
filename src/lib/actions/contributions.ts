'use server';

/**
 * Подача взноса (§6.2).
 *
 * Форма отправляется через `<form action={…}>` и `useActionState` — без
 * `preventDefault`, без ручного `fetch`, без флага «отправляется» в состоянии
 * (CLAUDE.md). Проверки, транзакция и запись в журнал аудита остаются
 * в резолвере `submitContribution`.
 */

import { revalidatePath } from 'next/cache';

import { contributionMutations } from '@/graphql/resolvers/mutation/contribution';
import { isIsoDate } from '@/lib/calc';
import { parseRubles } from '@/lib/money';

import {
  actionContext,
  callResolver,
  failure,
  success,
  toActionState,
  requiredField,
  type ActionState,
} from './runtime';

type SubmitArgs = { amount: number; paidAt: string; receiptFileId?: string | null };

export async function submitContributionAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const rawAmount = requiredField(form, 'amount');
  const paidAt = requiredField(form, 'paidAt');

  if (!isIsoDate(paidAt)) {
    return failure('Укажите дату платежа.', 'BAD_USER_INPUT');
  }

  let amount: number;
  try {
    // Человек пишет рубли, база хранит копейки. Разбор строгий: тихо
    // прочитать «1 2 3» как что-нибудь — худшее, что может сделать форма
    // с деньгами (§2.2).
    amount = parseRubles(rawAmount);
  } catch {
    return failure('Сумма непонятна. Пример: 500 или 500,50.', 'BAD_USER_INPUT');
  }

  if (amount <= 0) {
    return failure('Сумма взноса должна быть больше нуля.', 'BAD_USER_INPUT');
  }

  try {
    const context = await actionContext();
    await callResolver<SubmitArgs, unknown>(
      contributionMutations.submitContribution,
      // Чек к взносу — этап 6 (§8): прикрепление появится вместе с
      // распознаванием. Подставлять сюда выдуманный `fileId` нельзя, поэтому
      // его просто нет.
      { amount, paidAt },
      context,
    );
  } catch (error) {
    return toActionState(error, 'Не удалось отправить взнос.');
  }

  // Взнос виден сразу на «Моих взносах», в общей таблице и в ленте главной.
  revalidatePath('/', 'layout');
  return success('Взнос отправлен. Он появится в фонде после подтверждения администратором.');
}
