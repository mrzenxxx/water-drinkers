import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { MoneyAmount } from '@/components/admin/money-amount';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { confirmContributionAction, rejectContributionAction } from '@/lib/actions/admin';
import type { QueueItem } from '@/lib/data/admin';
import { formatKopecks } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Очередь подтверждений (§6.7).
 *
 * Серверный компонент: данные приходят из слоя данных напрямую, в бандл едут
 * только формы. Каждая карточка — одно решение администратора: подтвердить
 * или отклонить с комментарием.
 *
 * Распознавание чеков — этап 6. Пока его нет, показывается то, что есть,
 * и ни одна цифра не выдумывается: у взноса без извлечения так и написано.
 */

function CompareRow({
  label,
  entered,
  recognized,
  differs,
}: {
  label: string;
  entered: string;
  recognized: string | null;
  differs: boolean;
}): ReactNode {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 sm:grid-cols-[7rem_1fr_1fr]">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="tabular text-sm font-medium">{entered}</span>
      <span
        className={cn(
          'tabular text-sm',
          differs ? 'text-owes font-medium' : 'text-muted-foreground',
        )}
      >
        {recognized === null ? (
          <span className="text-muted-foreground">чек не распознан</span>
        ) : (
          <>
            {differs && <span aria-hidden="true">≠ </span>}
            {recognized}
            <span className="sr-only">{differs ? ' — расходится с введённым' : ''}</span>
          </>
        )}
      </span>
    </div>
  );
}

export function QueueList({ items }: { items: readonly QueueItem[] }): ReactNode {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Очередь пуста: все взносы рассмотрены.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <Card className={cn(item.needsAttention && 'border-owes')}>
            <CardHeader className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{item.userName}</CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Подан {item.submittedAt.slice(0, 10)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.needsAttention && (
                  <Badge variant="destructive">Требует внимания</Badge>
                )}
                {item.enteredByAdmin && <Badge variant="secondary">Внёс админ</Badge>}
                <MoneyAmount amount={item.amount} className="text-lg font-semibold" />
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="glass-soft flex flex-col gap-2 rounded-lg p-3">
                <div className="text-muted-foreground hidden text-xs sm:grid sm:grid-cols-[7rem_1fr_1fr] sm:gap-x-3">
                  <span />
                  <span>введено</span>
                  <span>с чека</span>
                </div>
                <CompareRow
                  label="Сумма"
                  entered={formatKopecks(item.amount)}
                  recognized={
                    item.extraction?.amountKopecks == null
                      ? null
                      : formatKopecks(item.extraction.amountKopecks)
                  }
                  differs={item.mismatch.amount}
                />
                <CompareRow
                  label="Дата платежа"
                  entered={item.paidAt}
                  recognized={item.extraction?.paidAt ?? null}
                  differs={item.mismatch.paidAt}
                />
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {item.receiptUrl === null ? (
                    <span className="text-muted-foreground text-xs">Чек не приложен</span>
                  ) : (
                    <a
                      href={item.receiptUrl}
                      className="text-primary text-sm underline underline-offset-4"
                    >
                      Открыть чек
                    </a>
                  )}
                  {item.mismatch.lowConfidence && (
                    <Badge variant="outline">Низкая уверенность распознавания</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <ActionForm action={confirmContributionAction} submitLabel="Подтвердить">
                  <input type="hidden" name="id" value={item.id} />
                </ActionForm>

                <details className="flex-1">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                    Отклонить с комментарием
                  </summary>
                  <ActionForm
                    action={rejectContributionAction}
                    submitLabel="Отклонить"
                    variant="destructive"
                    className="mt-3"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <Label htmlFor={`reject-${item.id}`}>Причина отказа</Label>
                    <Textarea
                      id={`reject-${item.id}`}
                      name="comment"
                      required
                      rows={2}
                      placeholder="Чек не читается"
                    />
                  </ActionForm>
                </details>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
