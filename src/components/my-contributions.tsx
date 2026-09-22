'use client';

import type { ReactNode } from 'react';
import { useActionState, useOptimistic } from 'react';

import { ContributionForm } from '@/components/contribution-form';
import { ContributionsList } from '@/components/contributions-list';
import { submitContributionAction } from '@/lib/actions/contributions';
import { IDLE } from '@/lib/actions/state';
import type { ContributionRow } from '@/lib/data/queries';
import type { NamedUser } from '@/lib/format';
import { parseRubles } from '@/lib/money';

/**
 * Свои взносы: форма и история под ней (§6.2).
 *
 * Клиентский компонент ровно ради одного — мгновенного отклика. Между
 * нажатием «Отправить» и ответом сервера проходит запрос к базе, и без
 * `useOptimistic` список секунду показывал бы, что взноса нет: человек
 * решает, что кнопка не сработала, и нажимает ещё раз.
 *
 * Отменять оптимистичную строку вручную не нужно: React снимает её сам,
 * когда действие завершится, а серверные данные придут заново после
 * `revalidatePath`. Ручной откат — это второй источник правды.
 *
 * Строка помечена статусом `PENDING`, и это не выдумка: взнос действительно
 * попадает в очередь на подтверждение и до неё на баланс не влияет
 * (правило 6 CLAUDE.md).
 */
export function MyContributions({
  rows,
  people,
  today,
  suggestedAmount,
  readOnly = false,
}: {
  rows: readonly ContributionRow[];
  /** Участники массивом: `Map` собирается здесь, чтобы не гонять её через границу. */
  people: readonly (NamedUser & { id: string })[];
  today: string;
  suggestedAmount: string;
  /** Режим только просмотра (мьют, §3): история есть, формы нет. */
  readOnly?: boolean;
}): ReactNode {
  const [optimisticRows, addOptimisticRow] = useOptimistic(
    rows,
    (current: readonly ContributionRow[], added: ContributionRow) => [added, ...current],
  );

  const [state, action] = useActionState(async (previous: typeof IDLE, form: FormData) => {
    const amount = readAmount(form);
    if (amount !== null) {
      // Оптимистичное обновление обязано случиться до `await`: после него
      // переход уже закрыт, и React отбросит изменение с предупреждением.
      addOptimisticRow({
        id: `optimistic:${amount}:${String(form.get('paidAt') ?? '')}`,
        userId: '',
        amount,
        paidAt: String(form.get('paidAt') ?? today),
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewComment: null,
        receiptId: null,
      });
    }

    return submitContributionAction(previous, form);
  }, IDLE);

  const byId = new Map(people.map((person) => [person.id, person]));

  return (
    <>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          Подавать взносы сейчас нельзя: администратор включил режим только просмотра.
        </p>
      ) : (
        <ContributionForm
          today={today}
          suggestedAmount={suggestedAmount}
          action={action}
          state={state}
        />
      )}
      <div className="mt-6">
        <ContributionsList
          rows={optimisticRows}
          people={byId}
          emptyText="Вы ещё не подавали взносов."
        />
      </div>
    </>
  );
}

/**
 * Сумма из формы или `null`, если её не прочитать.
 *
 * Неразобранная сумма не мешает отправке: настоящую проверку делает
 * серверное действие и оно же вернёт внятную ошибку. Здесь разбор нужен
 * только для того, чтобы нарисовать строку заранее, и врать в ней нельзя.
 */
function readAmount(form: FormData): number | null {
  try {
    const amount = parseRubles(String(form.get('amount') ?? ''));
    return amount > 0 ? amount : null;
  } catch {
    return null;
  }
}
