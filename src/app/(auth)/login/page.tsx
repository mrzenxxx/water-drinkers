'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Вход в два шага: почта, затем код из письма.
 *
 * Формы работают через `useActionState` (React 19): состояние ошибки и признак
 * ожидания приходят от самого хука, а не от ручных `useState`. Ни `preventDefault`,
 * ни флага `busy`, ни `useEffect` здесь нет: шаг выводится из состояния, а переход
 * после успешного входа делает само действие.
 */

async function callGraphQL(query: string, variables: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as { errors?: { message: string }[] };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Не удалось выполнить запрос.');
  }
}

const REQUEST_CODE = `
  mutation RequestLoginCode($email: String!) {
    requestLoginCode(email: $email) { ok expiresInSeconds }
  }
`;

const VERIFY_CODE = `
  mutation VerifyLoginCode($email: String!, $code: String!) {
    verifyLoginCode(email: $email, code: $code) {
      needsProfile
      user { id email firstName lastName }
    }
  }
`;

type ActionState = { error: string | null; done: boolean };

const IDLE: ActionState = { error: null, done: false };

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export default function LoginPage() {
  const router = useRouter();

  // Шаг не хранится отдельным состоянием, а выводится из адреса: пока он пуст,
  // показываем первый шаг. Два источника правды тут разъезжались бы.
  const [email, setEmail] = useState('');
  const step = email === '' ? 'email' : 'code';

  const [emailState, requestCode, requestPending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const address = String(formData.get('email') ?? '').trim();

      try {
        await callGraphQL(REQUEST_CODE, { email: address });
      } catch (cause) {
        return { error: messageOf(cause, 'Не удалось отправить код.'), done: false };
      }

      // Ответ одинаков для любого адреса (§7), поэтому ко второму шагу переходим
      // всегда: по поведению формы нельзя узнать, кто есть в списке участников.
      setEmail(address);
      return { error: null, done: true };
    },
    IDLE,
  );

  const [codeState, verifyCode, verifyPending] = useActionState<ActionState, FormData>(
    async (_previous, formData) => {
      const code = String(formData.get('code') ?? '').trim();

      try {
        await callGraphQL(VERIFY_CODE, { email, code });
      } catch (cause) {
        return { error: messageOf(cause, 'Не удалось войти.'), done: false };
      }

      // refresh обязателен: серверные компоненты должны перечитать состояние
      // уже с новой cookie, иначе главная отрисуется как для гостя.
      router.push('/');
      router.refresh();

      return { error: null, done: true };
    },
    IDLE,
  );

  const error = step === 'email' ? emailState.error : codeState.error;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <title>Вход — WaterDrinkers</title>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">WaterDrinkers</h1>
        <p className="text-muted-foreground text-sm">
          Вход по рабочей почте. Пароля нет — приходит одноразовый код.
        </p>
      </header>

      {step === 'email' ? (
        <form action={requestCode} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Рабочая почта</span>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              defaultValue={email}
              placeholder="i.ivanov@sspk.spb.ru"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <Button type="submit" disabled={requestPending} className="w-full">
            {requestPending ? 'Отправляем…' : 'Получить код'}
          </Button>
        </form>
      ) : (
        <form action={verifyCode} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Если <span className="text-foreground font-medium">{email}</span> есть в списке
            участников, код уже отправлен. Он действует 10 минут.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Код из письма</span>
            <input
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              placeholder="000000"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <Button type="submit" disabled={verifyPending} className="w-full">
            {verifyPending ? 'Проверяем…' : 'Войти'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setEmail('')}
          >
            Другой адрес
          </Button>
        </form>
      )}

      {error !== null && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </main>
  );
}
