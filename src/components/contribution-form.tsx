'use client';

import { Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionState } from '@/lib/actions/state';
import type { IsoDate } from '@/lib/calc/types';
import { formatDate } from '@/lib/format';
import { formatKopecks, type Kopecks } from '@/lib/money';

/**
 * Подача взноса (§6.2).
 *
 * Форма — `<form action={серверное действие}>` и `useActionState`; ожидание
 * показывает `useFormStatus` внутри кнопки. Ни `onSubmit`, ни `preventDefault`,
 * ни клиентского `fetch` (CLAUDE.md).
 *
 * Чека в форме нет. Прикрепление и распознавание — этап 6 (§8.4), и до тех
 * пор поле было бы выключенным полем с объяснением, почему оно выключено:
 * место занимает, сделать ничего нельзя. Пока дата и сумма вводятся руками,
 * а администратор сверяет их при подтверждении.
 *
 * Пока у человека есть взнос на рассмотрении, форма выключена целиком
 * (`<fieldset disabled>`) и над ней стоит объяснение (§6.2). Выключено, а не
 * спрятано: человек видит, куда вводить следующий взнос, и понимает, почему
 * сейчас нельзя. Сервер держит то же правило сам.
 */
export function ContributionForm({
  today,
  suggestedAmount,
  action,
  state,
  pending = null,
}: {
  today: string;
  /** Типовой взнос из настроек фонда, строкой в рублях. */
  suggestedAmount: string;
  /** Действие формы и его состояние держит хозяин экрана: он же показывает
      мгновенный отклик через `useOptimistic`. */
  action: (formData: FormData) => void;
  state: ActionState;
  /** Взнос на рассмотрении: пока он есть, новый не регистрируется. */
  pending?: { amount: Kopecks; paidAt: IsoDate } | null;
}): ReactNode {
  const locked = pending !== null;

  return (
    <form action={action} className="space-y-4">
      {locked && (
        <p
          role="status"
          className="glass-soft flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        >
          <Clock3 aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <span>
            У вас уже есть взнос на рассмотрении — {formatKopecks(pending.amount)} от{' '}
            {formatDate(pending.paidAt)}. Новый можно будет зарегистрировать, когда администратор
            его рассмотрит.
          </span>
        </p>
      )}

      <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Сумма, ₽</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              required
              defaultValue={suggestedAmount}
              placeholder="500"
              aria-describedby="amount-hint"
            />
            <p id="amount-hint" className="text-muted-foreground text-xs">
              Рубли и копейки: 500 или 500,50.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidAt">Дата платежа</Label>
            <Input
              id="paidAt"
              name="paidAt"
              type="date"
              required
              defaultValue={today}
              max={today}
            />
            <p className="text-muted-foreground text-xs">День, когда деньги действительно ушли.</p>
          </div>
        </div>

        {!locked && state.status !== 'idle' && state.message !== null && (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={state.status === 'error' ? 'text-owes text-sm' : 'text-credit text-sm'}
          >
            {state.message}
          </p>
        )}

        {/*
        Кнопка во всю ширину: это единственное действие формы, и целиться в
        неё не приходится — ни на телефоне, ни мышью.
      */}
        <SubmitButton pendingLabel="Регистрируем…" className="w-full">
          Зарегистрировать взнос
        </SubmitButton>
      </fieldset>
    </form>
  );
}
