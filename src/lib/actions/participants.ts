'use server';

/**
 * Учётные записи участников в админ-панели (§6.7, ADR-0004): заведение
 * с логином и паролем, перевыпуск учётных данных, правка ФИО и отдела,
 * мьют и бан.
 *
 * Как и остальные действия, эти зовут те же резолверы, что и HTTP-эндпоинт:
 * проверка прав, логина и пароля живёт там, а не здесь.
 */

import { GraphQLError } from 'graphql';
import { revalidatePath } from 'next/cache';

import type { ActionState } from '@/components/admin/action-state';
import type { CredentialsFormState, IssuedCredentialsView } from '@/components/admin/credentials-state';
import type {
  CredentialsSuggestion,
  MutationAddParticipantArgs,
  MutationIssueCredentialsArgs,
  MutationSetParticipantRestrictionArgs,
  MutationUpdateParticipantArgs,
  ParticipantProfileInput,
  QuerySuggestCredentialsArgs,
} from '@/graphql/generated/graphql';
import { Restriction } from '@/graphql/generated/graphql';
import { adminMutations } from '@/graphql/resolvers/mutation/admin';
import { participantMutations } from '@/graphql/resolvers/mutation/participant';
import { Query } from '@/graphql/resolvers/query';
import { parseRubles } from '@/lib/money';

import { actionContext, callResolver } from './runtime';

type Issued = { credentials: IssuedCredentialsView };

/** Поля, которые форма возвращает обратно после ответа (см. `CredentialsFormState`). */
const ECHOED = [
  'firstName',
  'middleName',
  'lastName',
  'email',
  'departmentId',
  'newDepartment',
  'joinedAt',
  'openingBalance',
  'login',
  'password',
];

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function echo(form: FormData): Record<string, string> {
  return Object.fromEntries(ECHOED.map((field) => [field, text(form, field)]));
}

function profileOf(form: FormData): ParticipantProfileInput {
  return {
    firstName: text(form, 'firstName'),
    middleName: text(form, 'middleName') || null,
    lastName: text(form, 'lastName'),
    email: text(form, 'email') || null,
    departmentId: text(form, 'departmentId') || null,
    newDepartment: text(form, 'newDepartment') || null,
  };
}

function errorState(previous: CredentialsFormState, form: FormData, cause: unknown): CredentialsFormState {
  let message = 'Не удалось выполнить действие. Подробности — в логе сервера.';
  let field: string | null = null;

  if (cause instanceof GraphQLError) {
    message = cause.message;
    field = typeof cause.extensions?.field === 'string' ? cause.extensions.field : null;
  } else if (cause instanceof RangeError) {
    message = cause.message;
  } else {
    console.error('[waterdrinkers] действие с учётными данными не выполнено:', cause);
  }

  return { status: 'error', message, field, values: echo(form), credentials: null, version: previous.version + 1 };
}

async function suggest(previous: CredentialsFormState, form: FormData, excludeUserId: string | null) {
  const ctx = await actionContext();
  const suggestion = await callResolver<QuerySuggestCredentialsArgs, CredentialsSuggestion>(
    Query.suggestCredentials,
    {
      firstName: text(form, 'firstName'),
      middleName: text(form, 'middleName') || null,
      lastName: text(form, 'lastName'),
      excludeUserId,
    },
    ctx,
  );

  return {
    status: 'suggested',
    message: 'Проверьте логин и пароль — их можно поправить.',
    field: null,
    values: { ...echo(form), login: suggestion.login, password: suggestion.password },
    credentials: null,
    version: previous.version + 1,
  } satisfies CredentialsFormState;
}

function issued(previous: CredentialsFormState, result: Issued, message: string): CredentialsFormState {
  return {
    status: 'issued',
    message,
    field: null,
    values: {},
    credentials: result.credentials,
    version: previous.version + 1,
  };
}

/** «Добавить участника»: `intent=suggest` — предложить логин и пароль, `intent=create` — завести. */
export async function participantFormAction(
  previous: CredentialsFormState,
  form: FormData,
): Promise<CredentialsFormState> {
  try {
    if (text(form, 'intent') === 'suggest') return await suggest(previous, form, null);

    const opening = text(form, 'openingBalance');
    let openingBalance = 0;
    if (opening !== '') {
      try {
        openingBalance = parseRubles(opening);
      } catch {
        throw new RangeError(`Начальное сальдо: «${opening}» не похоже на сумму в рублях.`);
      }
    }

    const ctx = await actionContext();
    const result = await callResolver<MutationAddParticipantArgs, Issued>(
      adminMutations.addParticipant,
      {
        input: {
          profile: profileOf(form),
          joinedAt: text(form, 'joinedAt'),
          openingBalance,
          login: text(form, 'login'),
          password: text(form, 'password'),
        },
      },
      ctx,
    );

    revalidatePath('/', 'layout');
    return issued(previous, result, 'Участник добавлен. Отправьте ему данные для входа.');
  } catch (cause) {
    return errorState(previous, form, cause);
  }
}

/** «Новые учётные данные» у существующего участника. Прежние входы отзываются. */
export async function credentialsFormAction(
  previous: CredentialsFormState,
  form: FormData,
): Promise<CredentialsFormState> {
  const id = text(form, 'id');
  try {
    if (text(form, 'intent') === 'suggest') return await suggest(previous, form, id);

    const ctx = await actionContext();
    const result = await callResolver<MutationIssueCredentialsArgs, Issued>(
      participantMutations.issueCredentials,
      { id, login: text(form, 'login'), password: text(form, 'password') },
      ctx,
    );

    revalidatePath('/', 'layout');
    return issued(previous, result, 'Учётные данные выданы, прежние входы отозваны.');
  } catch (cause) {
    return errorState(previous, form, cause);
  }
}

function adminFailure(cause: unknown): ActionState {
  if (cause instanceof GraphQLError) return { status: 'error', message: cause.message };
  console.error('[waterdrinkers] админское действие не выполнено:', cause);
  return { status: 'error', message: 'Не удалось выполнить действие. Подробности — в логе сервера.' };
}

export async function updateParticipantAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await actionContext();
    await callResolver<MutationUpdateParticipantArgs, unknown>(
      participantMutations.updateParticipant,
      { id: text(form, 'id'), input: profileOf(form) },
      ctx,
    );
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Сохранено.' };
  } catch (cause) {
    return adminFailure(cause);
  }
}

const RESTRICTION_DONE: Record<Restriction, string> = {
  [Restriction.None]: 'Ограничение снято.',
  [Restriction.Muted]: 'Теперь у участника только просмотр.',
  [Restriction.Banned]: 'Вход закрыт, открытые сессии завершены.',
};

export async function setRestrictionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const raw = text(form, 'restriction');
    const restriction = Object.values(Restriction).find((value) => value === raw);
    if (restriction === undefined) return { status: 'error', message: `Неизвестное ограничение «${raw}».` };

    const ctx = await actionContext();
    await callResolver<MutationSetParticipantRestrictionArgs, unknown>(
      participantMutations.setParticipantRestriction,
      { id: text(form, 'id'), restriction },
      ctx,
    );
    revalidatePath('/', 'layout');
    return { status: 'success', message: RESTRICTION_DONE[restriction] };
  } catch (cause) {
    return adminFailure(cause);
  }
}
