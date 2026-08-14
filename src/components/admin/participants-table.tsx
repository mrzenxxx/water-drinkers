import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { BalanceAmount, MoneyAmount } from '@/components/admin/money-amount';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deactivateParticipantAction,
  reactivateParticipantAction,
  setParticipantRoleAction,
  settleParticipantAction,
} from '@/lib/actions/admin';
import type { ParticipantRow } from '@/lib/data/admin';
import { toRublesString } from '@/lib/money';

/**
 * Состав участников (§6.7).
 *
 * На узких экранах таблица превращается в карточки, а не в горизонтальный
 * скролл (§12): в колонке действий живут формы, и уехавшая за край экрана
 * кнопка «Выплатить остаток» — это не мелкое неудобство, а недоступное действие.
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

function ParticipantActions({
  participant,
  today,
}: {
  participant: ParticipantRow;
  today: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <ActionForm
        action={setParticipantRoleAction}
        submitLabel={participant.role === 'ADMIN' ? 'Разжаловать' : 'Назначить администратором'}
        variant="outline"
        size="sm"
      >
        <input type="hidden" name="id" value={participant.id} />
        <input
          type="hidden"
          name="role"
          value={participant.role === 'ADMIN' ? 'PARTICIPANT' : 'ADMIN'}
        />
      </ActionForm>

      {participant.isActive ? (
        <details>
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
            Исключить из состава
          </summary>
          <ActionForm
            action={deactivateParticipantAction}
            submitLabel="Исключить"
            variant="destructive"
            size="sm"
            className="mt-2"
          >
            <input type="hidden" name="id" value={participant.id} />
            <Label htmlFor={`left-${participant.id}`}>Дата выхода</Label>
            <Input
              id={`left-${participant.id}`}
              name="leftAt"
              type="date"
              defaultValue={today}
              required
            />
            <p className="text-muted-foreground text-xs">
              Взносы и доли в заказах останутся в истории, доступ сохранится.
            </p>
          </ActionForm>
        </details>
      ) : (
        <ActionForm action={reactivateParticipantAction} submitLabel="Вернуть" variant="outline" size="sm">
          <input type="hidden" name="id" value={participant.id} />
        </ActionForm>
      )}

      {participant.balance > 0 && (
        <details>
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
            Выплатить остаток
          </summary>
          <ActionForm
            action={settleParticipantAction}
            submitLabel="Выплатить"
            variant="outline"
            size="sm"
            className="mt-2"
          >
            <input type="hidden" name="id" value={participant.id} />
            <Label htmlFor={`settle-${participant.id}`}>Сумма выплаты, ₽</Label>
            <Input
              id={`settle-${participant.id}`}
              name="amount"
              inputMode="decimal"
              defaultValue={toRublesString(participant.balance)}
              required
            />
            <Label htmlFor={`settle-note-${participant.id}`}>Комментарий</Label>
            <Input
              id={`settle-note-${participant.id}`}
              name="note"
              defaultValue="Возврат остатка при выходе"
              required
            />
            <p className="text-muted-foreground text-xs">
              В журнал операций уйдёт запись SETTLEMENT на эту сумму со знаком минус.
            </p>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

export function ParticipantsTable({
  participants,
  today,
}: {
  participants: readonly ParticipantRow[];
  today: string;
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
    <>
      {/* Узкие экраны: карточки. */}
      <ul className="flex flex-col gap-4 md:hidden">
        {participants.map((participant) => (
          <li key={participant.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{participant.name}</p>
                    {participant.hasProfile && (
                      <p className="text-muted-foreground text-xs">{participant.email}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <RoleBadge participant={participant} />
                    <StatusBadge participant={participant} />
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Баланс</dt>
                    <dd>
                      <BalanceAmount amount={participant.balance} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Начальное сальдо</dt>
                    <dd>
                      <MoneyAmount amount={participant.openingBalance} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">В составе с</dt>
                    <dd className="tabular">{participant.joinedAt}</dd>
                  </div>
                </dl>

                <ParticipantActions participant={participant} today={today} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {/* Широкие экраны: таблица. */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Участник</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Начальное сальдо</TableHead>
              <TableHead className="text-right">Баланс</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="align-top">
                  <p className="font-medium">{participant.name}</p>
                  {participant.hasProfile && (
                    <p className="text-muted-foreground text-xs">{participant.email}</p>
                  )}
                  <p className="text-muted-foreground text-xs">с {participant.joinedAt}</p>
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex flex-col items-start gap-1">
                    <RoleBadge participant={participant} />
                    <StatusBadge participant={participant} />
                  </div>
                </TableCell>
                <TableCell className="text-right align-top">
                  <MoneyAmount amount={participant.openingBalance} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <BalanceAmount amount={participant.balance} />
                </TableCell>
                <TableCell className="w-72 align-top">
                  <ParticipantActions participant={participant} today={today} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
