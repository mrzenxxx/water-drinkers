'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <form action={action} className="space-y-4">
      {redirectTo !== undefined && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <div className="space-y-2">
        <Label htmlFor="firstName">Имя</Label>
        <Input id="firstName" name="firstName" defaultValue={firstName} required autoFocus />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Фамилия</Label>
        <Input id="lastName" name="lastName" defaultValue={lastName} required />
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-owes text-sm">
          {state.message}
        </p>
      )}

      {state.status === 'success' && state.message !== null && (
        <p role="status" className="text-credit text-sm">
          {state.message}
        </p>
      )}

      <SubmitButton className="w-full" pendingLabel="Сохраняем…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
