import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { ContributionStatusBadge } from '@/components/contribution-status';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContributionRow } from '@/lib/data/queries';
import { formatDate, formatDateTime, fullName, type NamedUser } from '@/lib/format';

/**
 * Список взносов: §6.2 (свои) и §6.3 (все).
 *
 * На узком экране таблица превращается в карточки, а не в горизонтальный
 * скролл (§12) — поэтому разметки две, и обе описаны здесь один раз,
 * а не переписаны на каждом экране.
 *
 * Колонки чека здесь нет. Прикрепление чека к взносу — этап 6 (§8.4), и до
 * тех пор `receiptId` у каждой строки `null`: колонка состояла бы из одного
 * слова «без чека» сверху донизу и не говорила бы ничего. Вернётся она вместе
 * с настоящими чеками.
 *
 * Таблица растянута во всю ширину, а содержимое каждой колонки выровнено по
 * центру — и заголовок, и ячейки. Выключки вправо у чисел здесь нет намеренно:
 * колонок шесть, свободное место браузер раздаёт им всем, и прижатые к разным
 * краям столбцы расходились бы с собственными заголовками.
 */

type ContributionsListProps = {
  rows: readonly ContributionRow[];
  people: ReadonlyMap<string, NamedUser>;
  /** Показывать колонку участника: на «Моих взносах» она лишняя. */
  showPerson?: boolean;
  emptyText?: string;
};

export function ContributionsList({
  rows,
  people,
  showPerson = false,
  emptyText = 'Взносов пока нет.',
}: ContributionsListProps): ReactNode {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  const nameOf = (userId: string | null): string => {
    if (userId === null) return '—';
    const person = people.get(userId);
    return person === undefined ? '—' : fullName(person);
  };

  return (
    <>
      {/* Узкий экран: карточки. */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="glass-soft rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {showPerson && <p className="truncate font-medium">{nameOf(row.userId)}</p>}
                <p className="text-muted-foreground text-xs">
                  Платёж {formatDate(row.paidAt)} · подан {formatDateTime(row.submittedAt)}
                </p>
              </div>
              <Amount value={row.amount} className="font-medium" />
            </div>

            {/*
              На карточке подсказки нет — касание её не открывает, — поэтому
              причина отказа печатается ниже обычным текстом, а бейджику
              комментарий не передаётся: иначе одно и то же сказано дважды.
            */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <ContributionStatusBadge status={row.status} />
              {row.reviewedBy !== null && (
                <span className="text-muted-foreground">
                  Рассмотрел {nameOf(row.reviewedBy)}
                </span>
              )}
            </div>

            {row.status === 'REJECTED' && row.reviewComment !== null && (
              <p className="text-owes mt-2 text-xs">Причина: {row.reviewComment}</p>
            )}
          </li>
        ))}
      </ul>

      {/* Широкий экран: таблица. */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {showPerson && <TableHead className="text-center">Участник</TableHead>}
              <TableHead className="text-center">Сумма</TableHead>
              <TableHead className="text-center">Дата платежа</TableHead>
              <TableHead className="text-center">Подан</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead className="text-center">Рассмотрел</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {showPerson && <TableCell className="text-center">{nameOf(row.userId)}</TableCell>}
                <TableCell className="text-center">
                  <Amount value={row.amount} />
                </TableCell>
                <TableCell className="tabular text-center">{formatDate(row.paidAt)}</TableCell>
                <TableCell className="tabular text-muted-foreground text-center">
                  {formatDateTime(row.submittedAt)}
                </TableCell>
                <TableCell className="text-center">
                  <ContributionStatusBadge status={row.status} comment={row.reviewComment} />
                </TableCell>
                <TableCell className="text-muted-foreground text-center">
                  {row.reviewedBy === null ? '—' : nameOf(row.reviewedBy)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
