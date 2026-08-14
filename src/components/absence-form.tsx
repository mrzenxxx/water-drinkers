'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addAbsenceAction } from '@/lib/actions/absences';
import { IDLE } from '@/lib/actions/state';
import { ABSENCE_TYPE_LABEL } from '@/lib/format';

/**
 * Свои даты отсутствия (§6.6).
 *
 * Пересечение отсутствий запрещено базой (§11) и приезжает сюда ошибкой
 * с кодом `ABSENCE_OVERLAP`. Показываем её как обычное сообщение формы:
 * человеку важно, что даты пересекаются с уже отмеченными, а не то, какое
 * ограничение PostgreSQL сработало.
 */
export function AbsenceForm({ today }: { today: string }): ReactNode {
  const [state, action] = useActionState(addAbsenceAction, IDLE);

  const overlap = state.status === 'error' && state.code === 'ABSENCE_OVERLAP';

  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Тип</legend>
        <div className="flex flex-wrap gap-4">
          {(['VACATION', 'SICK_LEAVE'] as const).map((type, index) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="type"
                value={type}
                defaultChecked={index === 0}
                className="accent-primary size-4"
              />
              {ABSENCE_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startsOn">С</Label>
          <Input id="startsOn" name="startsOn" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsOn">По включительно</Label>
          <Input id="endsOn" name="endsOn" type="date" required defaultValue={today} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Примечание, необязательно</Label>
        <Input id="note" name="note" placeholder="Например: командировка" />
      </div>

      {state.status !== 'idle' && state.message !== null && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={state.status === 'error' ? 'text-owes text-sm' : 'text-credit text-sm'}
        >
          {state.message}
          {overlap && (
            <span className="text-muted-foreground mt-1 block text-xs">
              Нельзя быть одновременно в отпуске и на больничном: день вычелся бы дважды,
              и расчёт поехал бы. Удалите старую запись или измените даты.
            </span>
          )}
        </p>
      )}

      <SubmitButton pendingLabel="Сохраняем…">Отметить отсутствие</SubmitButton>
    </form>
  );
}
