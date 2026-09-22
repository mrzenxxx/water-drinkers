'use client';

import type { ReactNode } from 'react';
import { useActionState } from 'react';

import { CredentialFields, FormMessage, IntentButton } from '@/components/admin/credential-fields';
import { CredentialsCard } from '@/components/admin/credentials-card';
import { CREDENTIALS_IDLE } from '@/components/admin/credentials-state';
import { DepartmentField, type DepartmentOption } from '@/components/admin/department-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const invalid = (field: string) => (state.status === 'error' && state.field === field ? true : undefined);

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

        <form key={state.version} action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-last">Фамилия</Label>
              <Input
                id="participant-last"
                name="lastName"
                defaultValue={values.lastName}
                required
                aria-invalid={invalid('lastName')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-first">Имя</Label>
              <Input
                id="participant-first"
                name="firstName"
                defaultValue={values.firstName}
                required
                aria-invalid={invalid('firstName')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-middle">
                Отчество <span className="text-muted-foreground font-normal">— необязательно</span>
              </Label>
              <Input id="participant-middle" name="middleName" defaultValue={values.middleName} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DepartmentField
              departments={departments}
              idPrefix="participant"
              defaultId={values.departmentId}
              defaultNew={values.newDepartment}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-joined">Дата вступления</Label>
              <Input
                id="participant-joined"
                name="joinedAt"
                type="date"
                defaultValue={values.joinedAt || today}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="participant-opening">Начальное сальдо, ₽</Label>
              <Input
                id="participant-opening"
                name="openingBalance"
                inputMode="decimal"
                placeholder="0"
                defaultValue={values.openingBalance}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="participant-email">
              Почта <span className="text-muted-foreground font-normal">— необязательно, для справки</span>
            </Label>
            <Input
              id="participant-email"
              name="email"
              type="email"
              defaultValue={values.email}
              aria-invalid={invalid('email')}
              className="sm:max-w-sm"
            />
          </div>

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
        </form>
      </CardContent>
    </Card>
  );
}
