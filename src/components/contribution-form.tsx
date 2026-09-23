'use client';

import type { ReactNode } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionState } from '@/lib/actions/state';

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
 */
export function ContributionForm({
  today,
  suggestedAmount,
  action,
  state,
}: {
  today: string;
  /** Типовой взнос из настроек фонда, строкой в рублях. */
  suggestedAmount: string;
  /** Действие формы и его состояние держит хозяин экрана: он же показывает
      мгновенный отклик через `useOptimistic`. */
  action: (formData: FormData) => void;
  state: ActionState;
}): ReactNode {
  return (
    <form action={action} className="space-y-4">
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
          <Input id="paidAt" name="paidAt" type="date" required defaultValue={today} max={today} />
          <p className="text-muted-foreground text-xs">День, когда деньги действительно ушли.</p>
        </div>
      </div>

      {state.status !== 'idle' && state.message !== null && (
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
    </form>
  );
}
