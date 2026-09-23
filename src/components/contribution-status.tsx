'use client';

import { useState, type ReactNode } from 'react';

import { CONTRIBUTION_STATUS_ICON } from '@/components/status-icons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ContributionStatus } from '@/lib/calc/types';
import {
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_STATUS_VARIANT,
  formatDateTime,
} from '@/lib/format';

/**
 * Статус взноса бейджиком (§6.2, §6.3).
 *
 * Тот же бейджик, что в ленте главной, и те же значки: у каждого статуса своя
 * форма, поэтому цвет здесь ничего не несёт в одиночку (§12), а подпись стоит
 * рядом словами — читать её не надо, но она есть.
 *
 * **Кто и когда — в подсказке.** Бейджик говорит, что со взносом стало;
 * подсказка отвечает на следующий вопрос — кто это сделал, когда и, у отказа,
 * почему. Колонками эти три сведения не поставить: имя администратора было бы
 * одним и тем же сверху донизу, а время рассмотрения — третьей датой в строке,
 * где уже стоят две. Пока взнос не рассмотрен, подсказки нет вовсе: повторять
 * голосом подпись, которая и так написана рядом, незачем.
 *
 * Имя стоит без глагола: «Подтвердил» и «Отклонила» — выбор рода, которого у
 * приложения нет, а строка «имя · дата» под подписью статуса и так читается
 * как «кто и когда».
 *
 * **Касание открывает подсказку нажатием.** Наведения на телефоне нет, и
 * подсказка, живущая только на мыши, оставляла бы половину людей без причины
 * отказа. Поэтому у нежданного указателя (палец, перо) нажатие само
 * открывает и закрывает подсказку, а `preventDefault` не даёт Radix закрыть
 * её тем же событием. У мыши всё по-прежнему: наведение и фокус.
 *
 * Подсказка при этом остаётся добавкой, а не единственным путём к тексту: то
 * же самое едет рядом скрытой строкой для чтения с экрана.
 *
 * Клиентский компонент ровно ради этого: подсказка живёт на событиях
 * указателя и фокуса, серверной разметкой её не сделать.
 */
export function ContributionStatusBadge({
  status,
  comment = null,
  reviewer = null,
  reviewedAt = null,
}: {
  status: ContributionStatus;
  /** Комментарий администратора: у отказа это причина. */
  comment?: string | null;
  /** Имя администратора, рассмотревшего взнос. */
  reviewer?: string | null;
  /** Момент рассмотрения, ISO. */
  reviewedAt?: string | null;
}): ReactNode {
  const [open, setOpen] = useState(false);

  const Icon = CONTRIBUTION_STATUS_ICON[status];
  const label = CONTRIBUTION_STATUS_LABEL[status];
  const reason = blankToNull(comment);
  const who = blankToNull(reviewer);
  const when = reviewedAt === null ? null : formatDateTime(reviewedAt);
  const byLine = [who, when].filter((part) => part !== null).join(' · ');

  const badge = (
    <Badge variant={CONTRIBUTION_STATUS_VARIANT[status]} className="gap-1.5">
      <Icon aria-hidden />
      {label}
    </Badge>
  );

  if (byLine === '' && reason === null) return badge;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      {/*
        `badge-tap` держит высоту бейджика на сенсорном вводе: иначе общее
        правило растит любую кнопку до 44 пикселей и строка таблицы вырастает
        вместе с ней. Мишень при этом остаётся — её доращивает псевдоэлемент.
      */}
      <TooltipTrigger
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') return;
          // Radix закрывает подсказку по этому же нажатию; отменённое событие
          // до его обработчика не доходит, и нажатие остаётся нашим.
          event.preventDefault();
          setOpen((previous) => !previous);
        }}
        className="badge-tap focus-visible:ring-ring cursor-help rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        {badge}
        <span className="sr-only">
          {byLine === '' ? '' : ` ${byLine}.`}
          {reason === null ? '' : ` Причина: ${reason}`}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{label}</p>
        {/*
          Имя и момент — разными строками, а не через разделитель: вместе они
          не помещаются в ширину подсказки, и перенос оставлял бы точку-разделитель
          одну в начале строки.
        */}
        {who !== null && <p className="text-muted-foreground mt-1">{who}</p>}
        {when !== null && <p className="text-muted-foreground tabular">{when}</p>}
        {reason !== null && <p className="text-muted-foreground mt-1">Причина: {reason}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function blankToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
