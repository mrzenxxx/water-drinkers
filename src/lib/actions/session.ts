'use server';

/**
 * Профиль и выход (§7).
 *
 * Имя и фамилию человек вводит сам: приложение не выдумывает персональные
 * данные (§6.7), а из почты их не вывести. До заполнения профиля закрытые
 * экраны недоступны — проверку делает layout приложения.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { authMutations } from '@/graphql/resolvers/mutation/auth';
import { isInternalPath } from '@/lib/view/nav';

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

export async function updateProfileAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const firstName = requiredField(form, 'firstName');
  const lastName = requiredField(form, 'lastName');
  // Знакомство после первого входа уводит на главную, правка профиля остаётся
  // на месте и показывает «Сохранено». Поле пришло из браузера, поэтому чужой
  // адрес отбрасывается (`isInternalPath`), а не подставляется в переход.
  const redirectTo = optionalField(form, 'redirectTo');

  if (firstName === '' || lastName === '') {
    return failure('Заполните имя и фамилию.', 'BAD_USER_INPUT');
  }

  try {
    const context = await actionContext();
    await callResolver<{ firstName: string; lastName: string }, unknown>(
      authMutations.updateProfile,
      { firstName, lastName },
      context,
    );
  } catch (error) {
    return toActionState(error, 'Не удалось сохранить профиль.');
  }

  revalidatePath('/', 'layout');
  // `redirect` бросает управляющее исключение, поэтому стоит вне try:
  // внутри его поймал бы `catch` и показал бы ошибку вместо перехода.
  if (isInternalPath(redirectTo)) redirect(redirectTo);

  return success('Профиль сохранён.');
}

export async function logoutAction(): Promise<void> {
  const context = await actionContext();
  await callResolver<Record<string, never>, boolean>(authMutations.logout, {}, context);

  revalidatePath('/', 'layout');
  redirect('/login');
}
