import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { UNATTRIBUTED } from '@/components/admin/action-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { createAdjustmentAction } from '@/lib/actions/admin';
import type { ParticipantRow } from '@/lib/data/admin';

/**
 * Корректировка (§2.4) — встречная запись, которой гасится ошибка учёта.
 *
 * Журнал операций неизменяем (правило 4): подтверждённый по ошибке взнос
 * не «отменяется», а гасится этой формой, и в истории остаётся видно и ошибку,
 * и её исправление.
 *
 * Участник не выбран заранее, а «не знаю, чьи деньги» стоит отдельной строкой
 * внизу списка: §2.4 требует, чтобы это был осознанный выбор с обязательным
 * комментарием, а не путь наименьшего сопротивления.
 */
export function AdjustmentForm({
  participants,
}: {
  participants: readonly ParticipantRow[];
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Корректировка</CardTitle>
        <CardDescription>
          Сумма со знаком: минус — уменьшить баланс, плюс — увеличить. Комментарий обязателен.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={createAdjustmentAction} submitLabel="Внести корректировку">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field htmlFor="adjustment-user" label="Кого касается">
              <NativeSelect id="adjustment-user" name="userId" required defaultValue="">
                <option value="" disabled>
                  Выберите участника
                </option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                    {participant.isActive ? '' : ' (вышел)'}
                  </option>
                ))}
                <option value={UNATTRIBUTED}>Не знаю, чьи деньги — разделить поровну</option>
              </NativeSelect>
            </Field>
            <Field htmlFor="adjustment-amount" label="Сумма, ₽">
              <Input
                id="adjustment-amount"
                name="amount"
                inputMode="decimal"
                placeholder="-500,00"
                required
              />
            </Field>
          </div>

          <Field htmlFor="adjustment-comment" label="Комментарий">
            <Textarea
              id="adjustment-comment"
              name="comment"
              rows={2}
              required
              placeholder="Подтверждён взнос, которого не было"
            />
          </Field>

          <p className="text-muted-foreground text-xs">
            Корректировка без участника делится поровну между активными на дату операции (§2.4):
            иначе она изменила бы остаток фонда, не изменив ничей личный баланс.
          </p>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
