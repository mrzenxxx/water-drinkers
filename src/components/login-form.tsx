'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useActionState, useState, type ReactNode } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Field, Form, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { loginAction } from '@/lib/actions/session';
import { IDLE } from '@/lib/actions/state';

/**
 * Логин и пароль (§7). `<Form action>` + `useActionState`: ошибка приходит
 * состоянием и встаёт пузырьком под кнопкой, набранное при этом остаётся в
 * полях (`Form`). Ожидание — из `useFormStatus` в кнопке, переход после
 * успеха делает само действие.
 *
 * У пароля есть глаз — показать набранное. Пароль выдаёт администратор, и
 * набирают его с бумажки или из сообщения, вслепую и почти всегда с ошибкой;
 * дать посмотреть дешевле, чем заставлять вводить заново. Показ всегда
 * начинается выключенным: решает человек, а не поле.
 */
export function LoginForm(): ReactNode {
  const [state, formAction] = useActionState(loginAction, IDLE);
  const [shown, setShown] = useState(false);

  const Icon = shown ? EyeOff : Eye;
  const toggleLabel = shown ? 'Скрыть пароль' : 'Показать пароль';

  return (
    <Form action={formAction} state={state} className="space-y-5">
      <Field htmlFor="login" label="Логин">
        <Input
          id="login"
          name="login"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="i.ivanov"
        />
      </Field>

      <Field htmlFor="password" label="Пароль">
        <Input
          id="password"
          name="password"
          type={shown ? 'text' : 'password'}
          required
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          className="pr-11"
        />
        {/*
          Значок показывает, что произойдёт по нажатию, а не что включено
          сейчас: кнопка — это действие. Так же устроен переключатель темы.

          `aria-pressed` при этом говорит состояние: читалке нужно знать не
          только, куда ведёт кнопка, но и виден ли пароль прямо сейчас.
        */}
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={toggleLabel}
          aria-pressed={shown}
          aria-controls="password"
          title={toggleLabel}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </Field>

      <SubmitButton pendingLabel="Входим…" className="w-full">
        Войти
      </SubmitButton>

      {state.status === 'error' && <FormMessage tone="error">{state.message}</FormMessage>}
    </Form>
  );
}
