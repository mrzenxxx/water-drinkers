'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { deleteAbsenceAction } from '@/lib/actions/absences';
import { IDLE } from '@/lib/actions/state';

/**
 * Удаление своего отсутствия (§6.6).
 *
 * Календарь — не журнал операций: строку действительно удаляем, неизменяем
 * `fund_transactions` (правило 4), а не даты отпуска. Балансы после этого
 * пересчитываются сами: дни присутствия выводятся из текущего состояния.
 */
export function DeleteAbsenceButton({ id }: { id: string }): ReactNode {
  const [state, action] = useActionState(deleteAbsenceAction, IDLE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Удаляем…">
        Удалить
      </SubmitButton>
      {state.status === 'error' && (
        <span role="alert" className="text-owes text-xs">
          {state.message}
        </span>
      )}
    </form>
  );
}
