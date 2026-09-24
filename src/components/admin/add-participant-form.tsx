'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import {
  CredentialFields,
  FormMessage,
  IntentButton,
  credentialsFieldError,
} from '@/components/admin/credential-fields';
import { CredentialsCard } from '@/components/admin/credentials-card';
import { CREDENTIALS_IDLE } from '@/components/admin/credentials-state';
import { DepartmentField, type DepartmentOption } from '@/components/admin/department-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { participantFormAction } from '@/lib/actions/participants';

/**
 * Добавление участника (§6.7, ADR-0004).
 *
 * Администратор вводит ФИО (отчество необязательно) и отдел, жмёт
 * «Сгенерировать учётные данные», при желании правит логин и пароль и только
 * потом — «Создать пользователя». Карточка с данными и кнопкой «Скопировать»
 * появляется после записи.
 *
 * Начальное сальдо необязательно. Заполненное, оно той же транзакцией поднимает
 * начальное сальдо фонда (§4.2) — иначе `Σ балансов` немедленно разошлась бы
 * с остатком кассы.
 */
export function AddParticipantForm({
  today,
  departments,
}: {
  today: string;
  departments: readonly DepartmentOption[];
}): ReactNode {
  const [state, formAction] = useActionState(participantFormAction, CREDENTIALS_IDLE);
  const values = state.values;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавить участника</CardTitle>
        <CardDescription>
          ФИО и отдел, затем учётные данные. Логин предлагается из фамилии и инициалов, его и пароль
          можно поправить до создания.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.credentials !== null && <CredentialsCard credentials={state.credentials} />}

        <Form
          key={state.version}
          action={formAction}
          fieldError={credentialsFieldError(state)}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field htmlFor="participant-last" label="Фамилия">
              <Input id="participant-last" name="lastName" defaultValue={values.lastName} required />
            </Field>
            <Field htmlFor="participant-first" label="Имя">
              <Input id="participant-first" name="firstName" defaultValue={values.firstName} required />
            </Field>
            <Field htmlFor="participant-middle" label="Отчество" note="необязательно">
              <Input id="participant-middle" name="middleName" defaultValue={values.middleName} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DepartmentField
              departments={departments}
              idPrefix="participant"
              defaultId={values.departmentId}
              defaultNew={values.newDepartment}
            />
            <Field htmlFor="participant-joined" label="Дата вступления">
              <Input
                id="participant-joined"
                name="joinedAt"
                type="date"
                defaultValue={values.joinedAt || today}
                required
              />
            </Field>
            <Field htmlFor="participant-opening" label="Начальное сальдо, ₽" note="необязательно">
              <Input
                id="participant-opening"
                name="openingBalance"
                inputMode="decimal"
                placeholder="0"
                defaultValue={values.openingBalance}
              />
            </Field>
          </div>

          <Field
            htmlFor="participant-email"
            label="Почта"
            note="необязательно, для справки"
            className="sm:max-w-sm"
          >
            <Input id="participant-email" name="email" type="email" defaultValue={values.email} />
          </Field>

          <CredentialFields state={state} idPrefix="participant" />

          <div className="flex flex-col gap-2">
            <div>
              <IntentButton intent="create" pendingLabel="Создаём…">
                Создать пользователя
              </IntentButton>
            </div>
            <FormMessage state={state} />
            <p className="text-muted-foreground text-xs">
              Ненулевое начальное сальдо увеличит и начальное сальдо фонда: остаток у человека есть
              потому, что его деньги уже лежат в кассе (§4.2).
            </p>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
