import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { addAbsenceForAction, addContributionForAction } from '@/lib/actions/admin';
import type { ParticipantRow } from '@/lib/data/admin';

/**
 * Ввод за участника (§6.7): взнос и отсутствие за того, кто не может внести их
 * сам.
 *
 * Обе записи помечаются как внесённые администратором и попадают в журнал
 * аудита с указанием, кто и за кого их создал. Взнос очередь не проходит:
 * он сразу получает статус «Внёс админ» и считается в фонде
 * (ADR-0005).
 */

function ParticipantField({
  id,
  participants,
}: {
  id: string;
  participants: readonly ParticipantRow[];
}): ReactNode {
  return (
    <Field htmlFor={id} label="Участник">
      <NativeSelect id={id} name="userId" required defaultValue="">
        <option value="" disabled>
          Выберите участника
        </option>
        {participants.map((participant) => (
          <option key={participant.id} value={participant.id}>
            {participant.name}
            {participant.isActive ? '' : ' (вышел)'}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function ContributionForParticipant({
  participants,
  today,
  defaultContribution,
}: {
  participants: readonly ParticipantRow[];
  today: string;
  defaultContribution: string;
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Взнос за участника</CardTitle>
        <CardDescription>
          Сразу попадёт в фонд со статусом «Внёс админ», без очереди подтверждений
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={addContributionForAction} submitLabel="Внести взнос">
          <div className="grid gap-3 sm:grid-cols-3">
            <ParticipantField id="contribution-user" participants={participants} />
            <Field htmlFor="contribution-amount" label="Сумма, ₽">
              <Input
                id="contribution-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={defaultContribution}
                required
              />
            </Field>
            <Field htmlFor="contribution-paid" label="Дата платежа">
              <Input
                id="contribution-paid"
                name="paidAt"
                type="date"
                defaultValue={today}
                required
              />
            </Field>
          </div>
          <p className="text-muted-foreground text-xs">
            Чек к взносу прикладывается на этапе 6 вместе с распознаванием — выдумывать его
            данные приложение не станет. У заказов воды чек уже обязателен (§6.5).
          </p>
        </ActionForm>
      </CardContent>
    </Card>
  );
}

export function AbsenceForParticipant({
  participants,
  today,
}: {
  participants: readonly ParticipantRow[];
  today: string;
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Отсутствие за участника</CardTitle>
        <CardDescription>
          Отпуск или больничный. В расчёте они одинаковы: человека нет в офисе, воду он не пьёт
          (§4.1).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={addAbsenceForAction} submitLabel="Внести отсутствие">
          <div className="grid gap-3 sm:grid-cols-2">
            <ParticipantField id="absence-user" participants={participants} />
            <Field htmlFor="absence-type" label="Тип">
              <NativeSelect id="absence-type" name="type" defaultValue="VACATION">
                <option value="VACATION">Отпуск</option>
                <option value="SICK_LEAVE">Больничный</option>
              </NativeSelect>
            </Field>
            <Field htmlFor="absence-from" label="С">
              <Input id="absence-from" name="startsOn" type="date" defaultValue={today} required />
            </Field>
            <Field htmlFor="absence-to" label="По включительно">
              <Input id="absence-to" name="endsOn" type="date" defaultValue={today} required />
            </Field>
            <Field htmlFor="absence-note" label="Примечание" note="необязательно" className="sm:col-span-2">
              <Input id="absence-note" name="note" />
            </Field>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
