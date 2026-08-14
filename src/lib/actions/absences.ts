'use server';

/**
 * Свои отпуска и больничные (§6.6).
 *
 * Пересечение отсутствий запрещено базой (`EXCLUDE USING gist`, §11);
 * резолвер переводит нарушение в ошибку с кодом `ABSENCE_OVERLAP` и понятной
 * формулировкой. Действие эту формулировку не переписывает — она уже
 * человеческая и называет конкретные даты.
 */

import { revalidatePath } from 'next/cache';

import { absenceMutations } from '@/graphql/resolvers/mutation/absence';
import { compareDates, isIsoDate } from '@/lib/calc';
import type { AbsenceType } from '@/lib/calc/types';

import {
  actionContext,
  callResolver,
  failure,
  optionalField,
  requiredField,
  success,
  toActionState,
  type ActionState,
} from './runtime';

type AddArgs = { type: AbsenceType; startsOn: string; endsOn: string; note?: string | null };

const TYPES: readonly string[] = ['VACATION', 'SICK_LEAVE'];

export async function addAbsenceAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const type = requiredField(form, 'type');
  const startsOn = requiredField(form, 'startsOn');
  const endsOn = requiredField(form, 'endsOn');

  if (!TYPES.includes(type)) {
    return failure('Выберите тип: отпуск или больничный.', 'BAD_USER_INPUT');
  }
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) {
    return failure('Укажите обе даты.', 'BAD_USER_INPUT');
  }
  if (compareDates(endsOn, startsOn) < 0) {
    return failure('Дата окончания не может быть раньше даты начала.', 'BAD_USER_INPUT');
  }

  try {
    const context = await actionContext();
    await callResolver<AddArgs, unknown>(
      absenceMutations.addAbsence,
      { type: type as AbsenceType, startsOn, endsOn, note: optionalField(form, 'note') },
      context,
    );
  } catch (error) {
    return toActionState(error, 'Не удалось сохранить отсутствие.');
  }

  // Отсутствие меняет доли в открытом заказе (§4.4), значит и балансы на всех
  // экранах, а не только календарь.
  revalidatePath('/', 'layout');
  return success('Отсутствие отмечено.');
}

export async function deleteAbsenceAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = requiredField(form, 'id');
  if (id === '') return failure('Отсутствие не выбрано.', 'BAD_USER_INPUT');

  try {
    const context = await actionContext();
    await callResolver<{ id: string }, boolean>(absenceMutations.deleteAbsence, { id }, context);
  } catch (error) {
    return toActionState(error, 'Не удалось удалить отсутствие.');
  }

  revalidatePath('/', 'layout');
  return success('Отсутствие удалено.');
}
