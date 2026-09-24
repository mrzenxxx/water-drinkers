'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Field, Form, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { updateProfileAction } from '@/lib/actions/session';
import { IDLE } from '@/lib/actions/state';

/**
 * Имя и фамилия: и при первом входе (§7), и потом на странице профиля.
 *
 * `useActionState` + `<form action>`: ни `preventDefault`, ни ручного `fetch`,
 * ни флага «отправляется» (CLAUDE.md). Куда уйти после сохранения, решает
 * `redirectTo`: знакомство отправляет на главную, правка профиля остаётся
 * на месте и показывает подтверждение.
 */
export function ProfileForm({
  firstName,
  lastName,
  redirectTo,
  submitLabel = 'Сохранить',
}: {
  firstName: string;
  lastName: string;
  /** Адрес перехода после успеха. Без него форма остаётся на странице. */
  redirectTo?: string;
  submitLabel?: string;
}): ReactNode {
  const [state, action] = useActionState(updateProfileAction, IDLE);

  return (
    <Form action={action} state={state} className="space-y-4">
      {redirectTo !== undefined && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <Field htmlFor="firstName" label="Имя">
        <Input id="firstName" name="firstName" defaultValue={firstName} required autoFocus />
      </Field>

      <Field htmlFor="lastName" label="Фамилия">
        <Input id="lastName" name="lastName" defaultValue={lastName} required />
      </Field>

      {state.status === 'error' && <FormMessage tone="error">{state.message}</FormMessage>}

      {state.status === 'success' && state.message !== null && (
        <FormMessage tone="success">{state.message}</FormMessage>
      )}

      <SubmitButton className="w-full" pendingLabel="Сохраняем…">
        {submitLabel}
      </SubmitButton>
    </Form>
  );
}
