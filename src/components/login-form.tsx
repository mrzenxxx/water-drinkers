'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useActionState, useState, type ReactNode } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { loginAction } from '@/lib/actions/session';
import { IDLE } from '@/lib/actions/state';
import { cn } from '@/lib/utils';

const FIELD =
  'field-surface focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm transition-[color,box-shadow,border-color] focus-visible:ring-2 focus-visible:outline-none';

/**
 * Поле с подписью-стёклышком над ним.
 *
 * Подпись набрана тем же приёмом, что выбранный раздел в шапке
 * (`glass-soft nav-pill`): одна идея на два места, а не два похожих приёма.
 *
 * Оба поля формы собраны одной функцией, и это не ради краткости: подписи
 * разъезжались по высоте, хотя в разметке стояло одно и то же число.
 * Собранные из одного места, они разъехаться не могут — расстояние задано
 * один раз, в `.field-chip` (`globals.css`).
 *
 * Подпись связана с полем через `htmlFor`, а не объятием `<label>`: внутри
 * поля пароля живёт кнопка, а кнопка внутри подписи — это второй нажимаемый
 * элемент там, где браузер ждёт один.
 */
function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="field-chip-host">
      <label htmlFor={id} className="field-chip glass-soft nav-pill">
        {label}
      </label>
      {/* Обёртка ровно по полю: кнопка-глаз отмеряется от его краёв, не от подписи. */}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * Логин и пароль (§7). `<form action>` + `useActionState`: ошибка приходит
 * состоянием, ожидание — из `useFormStatus` в кнопке, переход после успеха
 * делает само действие.
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
    <form action={formAction} className="space-y-5">
      <Field id="login" label="Логин">
        <input
          id="login"
          name="login"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="i.ivanov"
          className={FIELD}
        />
      </Field>

      <Field id="password" label="Пароль">
        <input
          id="password"
          name="password"
          type={shown ? 'text' : 'password'}
          required
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          className={cn(FIELD, 'pr-11')}
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

      {state.status === 'error' && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
