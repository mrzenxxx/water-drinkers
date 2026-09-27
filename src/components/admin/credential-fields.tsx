'use client';

import { KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import type { CredentialsFormState } from '@/components/admin/credentials-state';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Field, FormMessage as Bubble } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

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

/**
 * Пузырёк результата под формой. Ошибка, привязанная к полю, стоит под самим
 * полем (`Form fieldError`) и здесь не повторяется.
 */
export function FormMessage({ state }: { state: CredentialsFormState }): ReactNode {
  if (state.status === 'idle' || state.status === 'issued' || state.message === '') return null;
  if (state.status === 'error' && state.field !== null) return null;
  return <Bubble tone={state.status === 'error' ? 'error' : 'info'}>{state.message}</Bubble>;
}

/** Ошибка, которую сервер привязал к полю, — в том виде, что ждёт `Form`. */
export function credentialsFieldError(state: CredentialsFormState): { name: string; message: string } | null {
  return state.status === 'error' && state.field !== null ? { name: state.field, message: state.message } : null;
}

/**
 * Логин и пароль: пусты до «Сгенерировать», дальше — предложенные значения,
 * которые администратор может поправить. Генерация идёт без проверки
 * обязательных полей (`formNoValidate`), запись — с ней.
 *
 * Раскладка следует за шириной места, а не экрана (`@container`): те же поля
 * стоят и в широкой форме добавления, и в узкой панели раскрытого участника.
 */
export function CredentialFields({ state, idPrefix }: { state: CredentialsFormState; idPrefix: string }): ReactNode {
  return (
    <div className="@container">
      <div className="grid items-start gap-3 @sm:grid-cols-2 @3xl:grid-cols-[1fr_1fr_auto]">
        <Field htmlFor={`${idPrefix}-login`} label="Логин">
          <Input
            id={`${idPrefix}-login`}
            name="login"
            defaultValue={state.values.login}
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <Field htmlFor={`${idPrefix}-password`} label="Пароль">
          <Input
            id={`${idPrefix}-password`}
            name="password"
            defaultValue={state.values.password}
            required
            minLength={8}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <IntentButton
          intent="suggest"
          pendingLabel="Генерируем…"
          variant="outline"
          formNoValidate
          className="@sm:col-span-2 @sm:justify-self-start @3xl:col-span-1 @3xl:mt-[2.125rem]"
        >
          <KeyRound aria-hidden />
          Сгенерировать учётные данные
        </IntentButton>
      </div>
    </div>
  );
}
