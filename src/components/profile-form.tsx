'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfileAction } from '@/lib/actions/session';
import { IDLE } from '@/lib/actions/state';

/**
 * Имя и фамилия при первом входе (§7).
 *
 * `useActionState` + `<form action>`: ни `preventDefault`, ни ручного `fetch`,
 * ни флага «отправляется» (CLAUDE.md). Переход после успеха делает само
 * действие — состояние успеха здесь даже не понадобится.
 */
export function ProfileForm({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): ReactNode {
  const [state, action] = useActionState(updateProfileAction, IDLE);

  return (
    <form action={action} className="space-y-4">
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

      <SubmitButton className="w-full" pendingLabel="Сохраняем…">
        Продолжить
      </SubmitButton>
    </form>
  );
}
