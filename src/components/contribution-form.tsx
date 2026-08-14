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
 * Распознавание чеков — этап 6 (§8). Пока его нет, дата и сумма вводятся
 * руками, а место под индикатор уверенности обозначено, но **не заполнено
 * выдуманными данными**: показать «уверенность 90 %» там, где ничего не
 * распознавалось, хуже, чем честно сказать, что распознавания ещё нет.
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

      <div className="border-border rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Чек</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Прикрепление и распознавание чеков появятся на этапе 6: под них ещё не выбрано
          хранилище. Пока сумму и дату вводит человек, а администратор сверяет их при
          подтверждении.
        </p>
        <input
          type="file"
          accept="image/*,.pdf"
          disabled
          aria-label="Файл чека (пока недоступно)"
          className="text-muted-foreground mt-3 block w-full text-xs disabled:cursor-not-allowed"
        />
        <p className="text-muted-foreground mt-3 text-xs">
          Здесь же встанет индикатор уверенности распознавания — пока показывать нечего.
        </p>
      </div>

      {state.status !== 'idle' && state.message !== null && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={state.status === 'error' ? 'text-owes text-sm' : 'text-credit text-sm'}
        >
          {state.message}
        </p>
      )}

      <SubmitButton pendingLabel="Отправляем…">Отправить взнос</SubmitButton>
    </form>
  );
}
