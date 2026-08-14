'use client';

import type { ReactNode } from 'react';
import { useActionState, useState } from 'react';

import { IDLE } from '@/components/admin/action-state';
import { SubmitButton } from '@/components/admin/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setOpeningBalancesAction } from '@/lib/actions/admin';
import { formatKopecks, parseRubles, toRublesString, type Kopecks } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Стартовое состояние учёта (§4.2).
 *
 * Форма клиентская ровно по одной причине: §4.2 требует показывать величину
 * расхождения и не давать продолжить, пока `Σ openingBalance(i)` не сравняется
 * с начальным сальдо фонда. Считать это после отправки поздно — человек должен
 * видеть, сколько ещё не разложено, пока набирает цифры.
 *
 * Настоящая проверка всё равно стоит на сервере: клиентская — удобство,
 * серверная — правило. Кнопка «Распределить поровну» ничего не считает сама:
 * доли раскладывает сервер методом наибольших остатков (§4.6), а в журнал
 * аудита уходит пометка equal-split.
 */

export type OpeningParticipant = {
  id: string;
  name: string;
  openingBalance: Kopecks;
};

/** Рубли из поля → копейки; `null`, если строку прочитать нельзя. */
function readRubles(value: string): Kopecks | null {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  try {
    return parseRubles(trimmed);
  } catch {
    return null;
  }
}

export function OpeningBalancesForm({
  participants,
  fundOpeningBalance,
  startDate,
  today,
}: {
  participants: readonly OpeningParticipant[];
  fundOpeningBalance: Kopecks;
  startDate: string | null;
  today: string;
}): ReactNode {
  const [state, formAction] = useActionState(setOpeningBalancesAction, IDLE);

  // Начальные значения полей — те же суммы, что уже сохранены: форма правит
  // состояние, а не заводит его заново с нуля.
  const [fundValue, setFundValue] = useState(() => toRublesString(fundOpeningBalance));
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(participants.map((p) => [p.id, toRublesString(p.openingBalance)])),
  );

  const fundTotal = readRubles(fundValue);
  let participantsTotal: Kopecks | null = 0;
  for (const participant of participants) {
    const value = readRubles(amounts[participant.id] ?? '');
    if (value === null || participantsTotal === null) {
      participantsTotal = null;
      break;
    }
    participantsTotal += value;
  }

  const readable = fundTotal !== null && participantsTotal !== null;
  const difference = readable ? (participantsTotal as number) - (fundTotal as number) : null;
  const consistent = difference === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Стартовое состояние фонда</CardTitle>
        <CardDescription>
          Сколько денег в кассе на дату начала учёта и чьи они. Пока суммы не сходятся, сохранить
          нельзя: это тот же инвариант §5, применённый к начальной точке.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-start">Дата начала учёта</Label>
              <Input
                id="opening-start"
                name="startDate"
                type="date"
                defaultValue={startDate ?? today}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-fund">Денег в фонде, ₽</Label>
              <Input
                id="opening-fund"
                name="fundOpeningBalance"
                inputMode="decimal"
                value={fundValue}
                onChange={(event) => setFundValue(event.target.value)}
                required
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Начальные сальдо участников</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`opening-${participant.id}`} className="text-sm font-normal">
                    {participant.name}
                  </Label>
                  <Input
                    id={`opening-${participant.id}`}
                    name={`opening:${participant.id}`}
                    inputMode="decimal"
                    className="max-w-36 text-right"
                    value={amounts[participant.id] ?? ''}
                    onChange={(event) =>
                      setAmounts((previous) => ({
                        ...previous,
                        [participant.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <p
            className={cn(
              'text-sm',
              !readable || !consistent ? 'text-owes font-medium' : 'text-credit',
            )}
            role="status"
          >
            {!readable ? (
              'Одна из сумм не читается: ожидаются рубли, например 1 250,50'
            ) : consistent ? (
              <>
                <span aria-hidden="true">✓ </span>
                Сходится: {formatKopecks(participantsTotal as number)}
              </>
            ) : (
              <>
                <span aria-hidden="true">✕ </span>
                Расхождение {formatKopecks(difference as number, { alwaysSign: true })}: у участников{' '}
                {formatKopecks(participantsTotal as number)}, в фонде{' '}
                {formatKopecks(fundTotal as number)}
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton disabled={!consistent}>Сохранить</SubmitButton>
            <SubmitButton
              name="intent"
              value="equal-split"
              variant="outline"
              pendingLabel="Делим…"
            >
              Распределить поровну
            </SubmitButton>
          </div>

          <p className="text-muted-foreground text-xs">
            «Распределить поровну» — осознанная потеря точности: сальдо участников будут заменены
            равными долями, и в журнале аудита останется пометка equal-split (§4.2).
          </p>

          {state.status !== 'idle' && (
            <p
              role="status"
              className={cn('text-sm', state.status === 'error' ? 'text-destructive' : 'text-credit')}
            >
              <span aria-hidden="true">{state.status === 'error' ? '✕ ' : '✓ '}</span>
              {state.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
