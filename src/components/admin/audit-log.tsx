import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AUDIT_ACTION_LABELS } from '@/lib/data/audit';
import type { AuditRow, ParticipantRow } from '@/lib/data/admin';

/**
 * Журнал аудита с фильтрами §6.7.
 *
 * Фильтры — обычная форма с методом GET: состояние экрана живёт в адресе,
 * им можно поделиться и на него можно сослаться. Клиентского состояния здесь
 * нет вовсе, поэтому нет и `'use client'`.
 */

export type AuditQuery = {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
};

export function AuditFilters({
  participants,
  query,
}: {
  participants: readonly ParticipantRow[];
  query: AuditQuery;
}): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал операций</CardTitle>
        <CardDescription>Кто, что и когда изменил. Записи не редактируются.</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="get" className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field htmlFor="filter-user" label="Участник">
              <NativeSelect id="filter-user" name="userId" defaultValue={query.userId ?? ''}>
                <option value="">Все</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field htmlFor="filter-action" label="Действие">
              <NativeSelect id="filter-action" name="action" defaultValue={query.action ?? ''}>
                <option value="">Все</option>
                {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field htmlFor="filter-from" label="С">
              <Input id="filter-from" name="from" type="date" defaultValue={query.from ?? ''} />
            </Field>

            <Field htmlFor="filter-to" label="По">
              <Input id="filter-to" name="to" type="date" defaultValue={query.to ?? ''} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline">
              Показать
            </Button>
            {/* Сброс — ссылка без параметров: кнопка отправки GET-формы,
                наоборот, унесла бы с собой все текущие значения полей. */}
            <Button asChild variant="ghost">
              <Link href="/admin/journal">Сбросить</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AuditTable({ rows }: { rows: readonly AuditRow[] }): ReactNode {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Записей нет: либо ничего ещё не происходило, либо фильтр слишком узкий.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Card>
              <CardContent className="flex flex-col gap-1 py-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{row.actionLabel}</span>
                  <span className="text-muted-foreground tabular text-xs">
                    {row.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                {row.summary !== '' && <p className="text-muted-foreground">{row.summary}</p>}
                <p className="text-muted-foreground text-xs">
                  {row.actorName ?? 'система'}
                  {row.subjectName !== null && row.subjectName !== row.actorName
                    ? ` → ${row.subjectName}`
                    : ''}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {/* Таблица стоит на стекле: иначе строки висели бы прямо на фоне. */}
      <div className="glass hidden rounded-xl px-4 py-2 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Когда</TableHead>
              <TableHead className="w-56">Действие</TableHead>
              <TableHead className="w-44">Кто</TableHead>
              <TableHead className="w-44">Кого касается</TableHead>
              <TableHead>Что изменилось</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="tabular whitespace-nowrap">
                  {row.createdAt.slice(0, 16).replace('T', ' ')}
                </TableCell>
                <TableCell>{row.actionLabel}</TableCell>
                <TableCell className="text-muted-foreground">{row.actorName ?? 'система'}</TableCell>
                <TableCell className="text-muted-foreground">{row.subjectName ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{row.summary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
