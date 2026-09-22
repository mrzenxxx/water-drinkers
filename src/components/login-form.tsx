'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { loginAction } from '@/lib/actions/session';
import { IDLE } from '@/lib/actions/state';

const FIELD =
  'field-surface focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm transition-[color,box-shadow,border-color] focus-visible:ring-2 focus-visible:outline-none';

/**
 * Логин и пароль (§7). `<form action>` + `useActionState`: ошибка приходит
 * состоянием, ожидание — из `useFormStatus` в кнопке, переход после успеха
 * делает само действие.
 */
export function LoginForm(): ReactNode {
  const [state, formAction] = useActionState(loginAction, IDLE);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">Логин</span>
        <input
          name="login"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="i.ivanov"
          className={FIELD}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Пароль</span>
        <input name="password" type="password" required autoComplete="current-password" className={FIELD} />
      </label>

      <SubmitButton pendingLabel="Входим…" className="w-full">
        Войти
      </SubmitButton>

      {state.status === 'error' && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
