'use client';

import type { ReactNode } from 'react';

import { CONTRIBUTION_STATUS_ICON } from '@/components/status-icons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ContributionStatus } from '@/lib/calc/types';
import { CONTRIBUTION_STATUS_LABEL, CONTRIBUTION_STATUS_VARIANT } from '@/lib/format';

/**
 * Статус взноса бейджиком (§6.2, §6.3).
 *
 * Тот же бейджик, что в ленте главной, и те же значки: у каждого статуса своя
 * форма, поэтому цвет здесь ничего не несёт в одиночку (§12), а подпись стоит
 * рядом словами — читать её не надо, но она есть.
 *
 * Причина отказа уходит в подсказку по наведению: в таблице она повторялась бы
 * в каждой строке и занимала больше места, чем сумма и обе даты вместе. Там,
 * где причины нет, нет и подсказки: повторять голосом подпись, которая и так
 * написана рядом, незачем.
 *
 * Подсказка — добавка, а не единственный путь к тексту: её нет у касания и нет
 * в чтении с экрана. Поэтому причина едет рядом скрытой строкой, а карточки
 * узкого экрана печатают её обычным текстом под бейджиком.
 *
 * Клиентский компонент ровно ради наведения: подсказка живёт на событиях мыши
 * и фокуса, серверной разметкой её не сделать.
 */
export function ContributionStatusBadge({
  status,
  comment = null,
}: {
  status: ContributionStatus;
  /** Комментарий администратора: у отказа это причина. */
  comment?: string | null;
}): ReactNode {
  const Icon = CONTRIBUTION_STATUS_ICON[status];
  const label = CONTRIBUTION_STATUS_LABEL[status];
  const reason = comment === null || comment.trim() === '' ? null : comment.trim();

  const badge = (
    <Badge variant={CONTRIBUTION_STATUS_VARIANT[status]} className="gap-1.5">
      <Icon aria-hidden />
      {label}
    </Badge>
  );

  if (reason === null) return badge;

  return (
    <Tooltip>
      {/*
        `badge-tap` держит высоту бейджика на сенсорном вводе: иначе общее
        правило растит любую кнопку до 44 пикселей и строка таблицы вырастает
        вместе с ней. Мишень при этом остаётся — её доращивает псевдоэлемент.
      */}
      <TooltipTrigger className="badge-tap focus-visible:ring-ring cursor-help rounded-full focus-visible:ring-2 focus-visible:outline-none">
        {badge}
        <span className="sr-only">Причина: {reason}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground mt-1">Причина: {reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
