import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { ContributionStatusIcon } from '@/components/contribution-status';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContributionRow } from '@/lib/data/queries';
import {
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_STATUS_VARIANT,
  formatDate,
  formatDateTime,
  fullName,
  type NamedUser,
} from '@/lib/format';

/**
 * Список взносов: §6.2 (свои) и §6.3 (все).
 *
 * На узком экране таблица превращается в карточки, а не в горизонтальный
 * скролл (§12) — поэтому разметки две, и обе описаны здесь один раз,
 * а не переписаны на каждом экране.
 */

type ContributionsListProps = {
  rows: readonly ContributionRow[];
  people: ReadonlyMap<string, NamedUser>;
  /** Показывать колонку участника: на «Моих взносах» она лишняя. */
  showPerson?: boolean;
  emptyText?: string;
};

/** Ссылка на чек. Выдача файлов — этап 6, поэтому пока только отметка о наличии. */
function ReceiptCell({ receiptId }: { receiptId: string | null }): ReactNode {
  if (receiptId === null) return <span className="text-muted-foreground">без чека</span>;

  return (
    <a href={`/api/receipts/${receiptId}`} className="underline underline-offset-2">
      Чек
    </a>
  );
}

/**
 * Статус словами — для карточек узкого экрана: подсказки по наведению там нет,
 * а касание её не открывает. В таблице статус показывает значок с подсказкой.
 */
function StatusBadge({ row }: { row: ContributionRow }): ReactNode {
  return (
    <Badge variant={CONTRIBUTION_STATUS_VARIANT[row.status]}>
      {CONTRIBUTION_STATUS_LABEL[row.status]}
    </Badge>
  );
}

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

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge row={row} />
              <ReceiptCell receiptId={row.receiptId} />
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
              {showPerson && <TableHead>Участник</TableHead>}
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead>Дата платежа</TableHead>
              <TableHead>Подан</TableHead>
              <TableHead className="w-16">Статус</TableHead>
              <TableHead>Рассмотрел</TableHead>
              <TableHead>Чек</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {showPerson && <TableCell>{nameOf(row.userId)}</TableCell>}
                <TableCell className="text-right">
                  <Amount value={row.amount} />
                </TableCell>
                <TableCell className="tabular">{formatDate(row.paidAt)}</TableCell>
                <TableCell className="tabular text-muted-foreground">
                  {formatDateTime(row.submittedAt)}
                </TableCell>
                <TableCell>
                  <ContributionStatusIcon status={row.status} comment={row.reviewComment} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.reviewedBy === null ? '—' : nameOf(row.reviewedBy)}
                </TableCell>
                <TableCell>
                  <ReceiptCell receiptId={row.receiptId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
