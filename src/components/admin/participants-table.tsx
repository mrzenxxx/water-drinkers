import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { DepartmentField, type DepartmentOption } from '@/components/admin/department-field';
import { IssueCredentialsForm } from '@/components/admin/issue-credentials-form';
import { BalanceAmount, MoneyAmount } from '@/components/admin/money-amount';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  deactivateParticipantAction,
  reactivateParticipantAction,
  setParticipantRoleAction,
  settleParticipantAction,
} from '@/lib/actions/admin';
import { setRestrictionAction, updateParticipantAction } from '@/lib/actions/participants';
import type { ParticipantRow } from '@/lib/data/admin';
import { toRublesString } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Состав участников (§6.7).
 *
 * Каждый участник — свёрнутая строка: имя, статус, сальдо, баланс. Нажатие
 * раскрывает под ней весь его контекст на полную ширину блока — данные,
 * учётные данные, ограничение, роль, состав, выплату. Раньше действия жили
 * в узкой колонке таблицы и раскрывались вниз по одному, растягивая строку
 * в длинный столбик; теперь у форм есть место, а таблица не уезжает за край
 * экрана на телефоне (§12).
 *
 * Кнопки «Удалить» здесь нет и не будет: удаление человека, за которым числятся
 * взносы и доли в заказах, ломает инвариант §5 и стирает историю (§6.7).
 */

function StatusBadge({ participant }: { participant: ParticipantRow }): ReactNode {
  return participant.isActive ? (
    <Badge variant="secondary">В составе</Badge>
  ) : (
    <Badge variant="outline">Вышел {participant.leftAt}</Badge>
  );
}

function RoleBadge({ participant }: { participant: ParticipantRow }): ReactNode {
  return participant.role === 'ADMIN' ? <Badge>Администратор</Badge> : null;
}

const RESTRICTION_LABEL = { NONE: 'Без ограничений', MUTED: 'Только просмотр', BANNED: 'Вход закрыт' } as const;

function RestrictionBadge({ participant }: { participant: ParticipantRow }): ReactNode {
  if (participant.restriction === 'NONE') return null;
  return <Badge variant="destructive">{RESTRICTION_LABEL[participant.restriction]}</Badge>;
}

/** Логин и отдел под именем: по логину человек входит, его спрашивают первым. */
function ParticipantMeta({ participant }: { participant: ParticipantRow }): ReactNode {
  return (
    <>
      <p className="text-muted-foreground font-mono text-xs">
        {participant.login}
        {!participant.hasCredentials && <span className="font-sans"> · пароль не выдан</span>}
      </p>
      {participant.department !== null && (
        <p className="text-muted-foreground text-xs">{participant.department}</p>
      )}
    </>
  );
}

function EditParticipantForm({
  participant,
  departments,
}: {
  participant: ParticipantRow;
  departments: readonly DepartmentOption[];
}): ReactNode {
  const id = `edit-${participant.id}`;
  return (
    <ActionForm action={updateParticipantAction} submitLabel="Сохранить" size="sm">
      <input type="hidden" name="id" value={participant.id} />
      <Field htmlFor={`${id}-last`} label="Фамилия">
        <Input id={`${id}-last`} name="lastName" defaultValue={participant.lastName ?? ''} required />
      </Field>
      {/* Имя и отчество встают рядом, только когда панели хватает ширины. */}
      <div className="@container">
        <div className="grid gap-3 @sm:grid-cols-2">
          <Field htmlFor={`${id}-first`} label="Имя">
            <Input id={`${id}-first`} name="firstName" defaultValue={participant.firstName ?? ''} required />
          </Field>
          <Field htmlFor={`${id}-middle`} label="Отчество" note="необязательно">
            <Input id={`${id}-middle`} name="middleName" defaultValue={participant.middleName ?? ''} />
          </Field>
        </div>
      </div>
      <DepartmentField
        departments={departments}
        idPrefix={id}
        defaultId={participant.departmentId ?? undefined}
      />
      <Field htmlFor={`${id}-email`} label="Почта" note="необязательно" hint="Логин от смены ФИО не меняется">
        <Input id={`${id}-email`} name="email" type="email" defaultValue={participant.email ?? ''} />
      </Field>
    </ActionForm>
  );
}

/**
 * Мьют и бан (§3). Администратору ограничение не ставится — чтобы
 * ограничить, сначала снимите роль.
 */
function RestrictionForm({ participant }: { participant: ParticipantRow }): ReactNode {
  const id = `restriction-${participant.id}`;
  return (
    <ActionForm action={setRestrictionAction} submitLabel="Применить" variant="outline" size="sm">
      <input type="hidden" name="id" value={participant.id} />
      <Field htmlFor={id} label="Режим">
        <NativeSelect id={id} name="restriction" defaultValue={participant.restriction}>
          <option value="NONE">{RESTRICTION_LABEL.NONE}</option>
          <option value="MUTED">{RESTRICTION_LABEL.MUTED} — не может добавлять записи</option>
          <option value="BANNED">{RESTRICTION_LABEL.BANNED} — не может войти</option>
        </NativeSelect>
      </Field>
    </ActionForm>
  );
}

/** Панель действий в раскрытой строке: заголовок, пояснение, форма. */
function Panel({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className={cn('glass-soft flex flex-col gap-3 rounded-lg p-4', className)}>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint !== undefined && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function RoleForm({ participant }: { participant: ParticipantRow }): ReactNode {
  const isAdmin = participant.role === 'ADMIN';
  return (
    <ActionForm
      action={setParticipantRoleAction}
      submitLabel={isAdmin ? 'Разжаловать' : 'Назначить администратором'}
      variant="outline"
      size="sm"
    >
      <input type="hidden" name="id" value={participant.id} />
      <input type="hidden" name="role" value={isAdmin ? 'PARTICIPANT' : 'ADMIN'} />
    </ActionForm>
  );
}

function MembershipForm({ participant, today }: { participant: ParticipantRow; today: string }): ReactNode {
  if (!participant.isActive) {
    return (
      <ActionForm action={reactivateParticipantAction} submitLabel="Вернуть в состав" variant="outline" size="sm">
        <input type="hidden" name="id" value={participant.id} />
      </ActionForm>
    );
  }

  return (
    <ActionForm action={deactivateParticipantAction} submitLabel="Исключить" variant="destructive" size="sm">
      <input type="hidden" name="id" value={participant.id} />
      <Field htmlFor={`left-${participant.id}`} label="Дата выхода">
        <Input id={`left-${participant.id}`} name="leftAt" type="date" defaultValue={today} required />
      </Field>
    </ActionForm>
  );
}

function SettleForm({ participant }: { participant: ParticipantRow }): ReactNode {
  return (
    <ActionForm action={settleParticipantAction} submitLabel="Выплатить" variant="outline" size="sm">
      <input type="hidden" name="id" value={participant.id} />
      <Field htmlFor={`settle-${participant.id}`} label="Сумма выплаты, ₽">
        <Input
          id={`settle-${participant.id}`}
          name="amount"
          inputMode="decimal"
          defaultValue={toRublesString(participant.balance)}
          required
        />
      </Field>
      <Field htmlFor={`settle-note-${participant.id}`} label="Комментарий">
        <Input
          id={`settle-note-${participant.id}`}
          name="note"
          defaultValue="Возврат остатка при выходе"
          required
        />
      </Field>
    </ActionForm>
  );
}

/**
 * Всё, что можно сделать с участником, — раскрытым блоком на всю ширину
 * строки. Панели встают в сетку: на телефоне столбиком, на широком экране
 * по три в ряд, и ни одна форма не зажата в узкую колонку.
 */
function ParticipantPanels({
  participant,
  today,
  departments,
}: {
  participant: ParticipantRow;
  today: string;
  departments: readonly DepartmentOption[];
}): ReactNode {
  return (
    <div className="grid items-start gap-3 px-3 pt-1 pb-3 sm:px-4 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Данные">
        <EditParticipantForm participant={participant} departments={departments} />
      </Panel>

      <Panel title={participant.hasCredentials ? 'Новые учётные данные' : 'Выдать учётные данные'}>
        <IssueCredentialsForm participant={participant} />
      </Panel>

      <div className="flex flex-col gap-3 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
        {participant.role !== 'ADMIN' && (
          <Panel title="Ограничение" hint="Администратору не ставится — сначала снимите роль">
            <RestrictionForm participant={participant} />
          </Panel>
        )}

        <Panel title="Роль" hint={participant.role === 'ADMIN' ? 'Сейчас администратор' : 'Сейчас участник'}>
          <RoleForm participant={participant} />
        </Panel>

        <Panel
          title={participant.isActive ? 'Исключить из состава' : 'Вернуть в состав'}
          hint={
            participant.isActive
              ? 'Взносы и доли в заказах останутся в истории, доступ сохранится'
              : `Вышел ${participant.leftAt}`
          }
        >
          <MembershipForm participant={participant} today={today} />
        </Panel>

        {participant.balance > 0 && (
          <Panel title="Выплатить остаток" hint="В журнал операций уйдёт запись SETTLEMENT на эту сумму со знаком минус">
            <SettleForm participant={participant} />
          </Panel>
        )}
      </div>
    </div>
  );
}

/** Общая сетка подписей колонок и свёрнутой строки: колонки совпадают. */
const ROW_GRID = 'md:grid md:grid-cols-[minmax(0,1fr)_11rem_8rem_9rem_1rem] md:items-start md:gap-4';

function ParticipantItem({
  participant,
  today,
  departments,
}: {
  participant: ParticipantRow;
  today: string;
  departments: readonly DepartmentOption[];
}): ReactNode {
  return (
    /*
      Раскрытие на `<details>`, как у объявлений в ленте: состояние живёт в
      самом элементе, компонент остаётся серверным. Общее имя делает список
      аккордеоном — открытым остаётся один участник, и страница не
      разрастается в стену форм.
    */
    <details name="participant" className="disclosure group glass overflow-hidden rounded-xl">
      <summary
        className={cn(
          'focus-visible:ring-ring flex cursor-pointer list-none flex-wrap items-start gap-x-4 gap-y-2 rounded-xl px-3 py-3 focus-visible:ring-2 focus-visible:outline-none sm:px-4 [&::-webkit-details-marker]:hidden',
          ROW_GRID,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{participant.name}</p>
          <ParticipantMeta participant={participant} />
          <p className="text-muted-foreground text-xs">с {participant.joinedAt}</p>
        </div>

        {/*
          Стрелка декоративна: состояние «свёрнуто/развёрнуто» браузер
          сообщает сам. На телефоне она стоит справа от имени, на широком
          экране — в последней колонке.
        */}
        <ChevronDown
          aria-hidden
          className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 md:order-last"
        />

        <div className="flex basis-full flex-wrap gap-1.5 md:flex-col md:items-start">
          <RoleBadge participant={participant} />
          <RestrictionBadge participant={participant} />
          <StatusBadge participant={participant} />
        </div>

        <dl className="contents text-sm">
          <div className="md:text-right">
            <dt className="text-muted-foreground text-xs md:sr-only">Начальное сальдо</dt>
            <dd>
              <MoneyAmount amount={participant.openingBalance} />
            </dd>
          </div>
          <div className="md:text-right">
            <dt className="text-muted-foreground text-xs md:sr-only">Баланс</dt>
            <dd>
              <BalanceAmount amount={participant.balance} className="md:justify-end" />
            </dd>
          </div>
        </dl>
      </summary>

      <ParticipantPanels participant={participant} today={today} departments={departments} />
    </details>
  );
}

export function ParticipantsTable({
  participants,
  today,
  departments,
}: {
  participants: readonly ParticipantRow[];
  today: string;
  departments: readonly DepartmentOption[];
}): ReactNode {
  if (participants.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Участников пока нет. Начните с формы выше.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Подписи колонок — только на широком экране; на узком подписи стоят у чисел. */}
      <div aria-hidden className={cn('text-muted-foreground hidden px-4 text-xs font-medium', ROW_GRID)}>
        <span>Участник</span>
        <span>Статус</span>
        <span className="text-right">Начальное сальдо</span>
        <span className="text-right">Баланс</span>
        <span />
      </div>

      <ul className="flex flex-col gap-2">
        {participants.map((participant) => (
          <li key={participant.id}>
            <ParticipantItem participant={participant} today={today} departments={departments} />
          </li>
        ))}
      </ul>
    </div>
  );
}
