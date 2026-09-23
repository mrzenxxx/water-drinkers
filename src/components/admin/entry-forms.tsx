import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { addAbsenceForAction, addContributionForAction } from '@/lib/actions/admin';
import type { ParticipantRow } from '@/lib/data/admin';

/**
 * Ввод за участника (§6.7): взнос и отсутствие за того, кто не может внести их
 * сам.
 *
 * Обе записи помечаются как внесённые администратором и попадают в журнал
 * аудита с указанием, кто и за кого их создал. Взнос очередь не проходит:
 * он сразу получает статус «Внесён администратором» и считается в фонде
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
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Участник</Label>
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
    </div>
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
          Сразу попадёт в фонд со статусом «Внесён администратором», без очереди подтверждений
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={addContributionForAction} submitLabel="Внести взнос">
          <div className="grid gap-3 sm:grid-cols-3">
            <ParticipantField id="contribution-user" participants={participants} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="contribution-amount">Сумма, ₽</Label>
              <Input
                id="contribution-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={defaultContribution}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contribution-paid">Дата платежа</Label>
              <Input
                id="contribution-paid"
                name="paidAt"
                type="date"
                defaultValue={today}
                required
              />
            </div>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="absence-type">Тип</Label>
              <NativeSelect id="absence-type" name="type" defaultValue="VACATION">
                <option value="VACATION">Отпуск</option>
                <option value="SICK_LEAVE">Больничный</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="absence-from">С</Label>
              <Input id="absence-from" name="startsOn" type="date" defaultValue={today} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="absence-to">По включительно</Label>
              <Input id="absence-to" name="endsOn" type="date" defaultValue={today} required />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="absence-note">Примечание</Label>
              <Input id="absence-note" name="note" placeholder="Необязательно" />
            </div>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
