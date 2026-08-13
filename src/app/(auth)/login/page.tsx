'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

type Step = 'email' | 'code';

async function callGraphQL(query: string, variables: Record<string, unknown>) {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Не удалось выполнить запрос.');
  }

  return payload.data ?? {};
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

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await callGraphQL(REQUEST_CODE, { email });
      // Ответ одинаков для любого адреса (§7), поэтому переходим ко второму
      // шагу всегда: по поведению формы нельзя узнать, кто в списке.
      setStep('code');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить код.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await callGraphQL(VERIFY_CODE, { email, code });
      // refresh обязателен: серверные компоненты должны перечитать состояние
      // уже с новой cookie, иначе главная отрисуется как для гостя.
      router.push('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">WaterDrinkers</h1>
        <p className="text-muted-foreground text-sm">
          Вход по рабочей почте. Пароля нет — приходит одноразовый код.
        </p>
      </header>

      {step === 'email' ? (
        <form onSubmit={submitEmail} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Рабочая почта</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="i.ivanov@sspk.spb.ru"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Отправляем…' : 'Получить код'}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Если <span className="text-foreground font-medium">{email}</span> есть в списке
            участников, код уже отправлен. Он действует 10 минут.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Код из письма</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <Button type="submit" disabled={busy || code.length < 6} className="w-full">
            {busy ? 'Проверяем…' : 'Войти'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
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
