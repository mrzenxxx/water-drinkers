'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { CredentialFields, FormMessage, IntentButton } from '@/components/admin/credential-fields';
import { CredentialsCard } from '@/components/admin/credentials-card';
import { CREDENTIALS_IDLE } from '@/components/admin/credentials-state';
import { credentialsFormAction } from '@/lib/actions/participants';
import type { ParticipantRow } from '@/lib/data/admin';

/**
 * Новые логин, пароль и ссылка для уже заведённого участника: те же два шага,
 * что и при добавлении. Сохранение отзывает все прежние входы человека.
 */
export function IssueCredentialsForm({ participant }: { participant: ParticipantRow }): ReactNode {
  const [state, formAction] = useActionState(credentialsFormAction, {
    ...CREDENTIALS_IDLE,
    values: { login: participant.login },
  });

  return (
    <div className="mt-2 flex flex-col gap-3">
      {state.credentials !== null && <CredentialsCard credentials={state.credentials} />}

      <form key={state.version} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={participant.id} />
        <input type="hidden" name="firstName" value={participant.firstName ?? ''} />
        <input type="hidden" name="middleName" value={participant.middleName ?? ''} />
        <input type="hidden" name="lastName" value={participant.lastName ?? ''} />

        <CredentialFields state={state} idPrefix={`credentials-${participant.id}`} />

        <div>
          <IntentButton intent="issue" pendingLabel="Сохраняем…" size="sm">
            Сохранить
          </IntentButton>
        </div>
        <FormMessage state={state} />
        <p className="text-muted-foreground text-xs">
          {participant.hasCredentials
            ? 'Старый пароль и ссылка перестанут работать, открытые сессии завершатся.'
            : 'У участника ещё нет пароля — без него войти нельзя.'}
        </p>
      </form>
    </div>
  );
}
