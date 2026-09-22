'use server';

/**
 * Вход, профиль и выход (§7, ADR-0004).
 *
 * ФИО участника вводит администратор при заведении; экран знакомства остаётся
 * для тех, кого завели раньше без имени. До заполнения профиля закрытые
 * экраны недоступны — проверку делает layout приложения.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { cookies } from 'next/headers';

import { authMutations } from '@/graphql/resolvers/mutation/auth';
import { SESSION_COOKIE, authConfigFromEnv, loginWithMagicLink, sessionCookieOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
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

/**
 * Вход по логину и паролю. Ошибка остаётся на форме, успех уводит на главную:
 * `redirect` стоит вне `try`, иначе его управляющее исключение поймал бы
 * `catch` и показал бы вместо перехода.
 */
export async function loginAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const login = requiredField(form, 'login');
  const password = form.get('password');

  if (login === '' || typeof password !== 'string' || password === '') {
    return failure('Введите логин и пароль.', 'BAD_USER_INPUT');
  }

  try {
    const context = await actionContext();
    await callResolver<{ login: string; password: string }, unknown>(
      authMutations.login,
      { login, password },
      context,
    );
  } catch (error) {
    return toActionState(error, 'Не удалось войти.');
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Вход по магической ссылке — по нажатию кнопки на странице `/l/[token]`,
 * а не при самом открытии адреса: превью ссылок в мессенджерах загружают
 * адрес заранее и получили бы настоящую сессию.
 */
export async function magicLinkLoginAction(form: FormData): Promise<void> {
  const token = form.get('token');
  const config = authConfigFromEnv();
  const result = await loginWithMagicLink(prisma, config, typeof token === 'string' ? token : '');

  if (!result.ok) redirect('/login?link=invalid');

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(config.appUrl));
  revalidatePath('/', 'layout');
  redirect('/');
}

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
