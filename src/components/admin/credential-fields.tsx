'use client';

import { KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import type { CredentialsFormState } from '@/components/admin/credentials-state';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Кнопка одного из шагов формы. Шаг уходит полем `intent`, а ожидание
 * показывается только у нажатой кнопки: `useFormStatus` отдаёт отправленные
 * данные, и по ним видно, какая из двух кнопок сработала.
 */
export function IntentButton({
  intent,
  pendingLabel,
  children,
  ...props
}: ButtonProps & { intent: string; pendingLabel: string }): ReactNode {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get('intent') === intent;

  return (
    <Button type="submit" name="intent" value={intent} disabled={pending} {...props}>
      {mine ? pendingLabel : children}
    </Button>
  );
}

/** Строка результата под формой. Цвет — не единственный носитель смысла (§12). */
export function FormMessage({ state }: { state: CredentialsFormState }): ReactNode {
  if (state.status === 'idle' || state.status === 'issued') return null;
  return (
    <p role="status" className={cn('text-sm', state.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
      {state.status === 'error' && <span aria-hidden="true">✕ </span>}
      {state.message}
    </p>
  );
}

/**
 * Логин и пароль: пусты до «Сгенерировать», дальше — предложенные значения,
 * которые администратор может поправить. Генерация идёт без проверки
 * обязательных полей (`formNoValidate`), запись — с ней.
 */
export function CredentialFields({ state, idPrefix }: { state: CredentialsFormState; idPrefix: string }): ReactNode {
  const invalid = (field: string) => (state.status === 'error' && state.field === field ? true : undefined);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-login`}>Логин</Label>
        <Input
          id={`${idPrefix}-login`}
          name="login"
          defaultValue={state.values.login}
          required
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid('login')}
          className="font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-password`}>Пароль</Label>
        <Input
          id={`${idPrefix}-password`}
          name="password"
          defaultValue={state.values.password}
          required
          minLength={8}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid('password')}
          className="font-mono"
        />
      </div>
      <IntentButton intent="suggest" pendingLabel="Генерируем…" variant="outline" formNoValidate>
        <KeyRound aria-hidden />
        Сгенерировать учётные данные
      </IntentButton>
    </div>
  );
}
