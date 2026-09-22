'use client';

import { CircleCheck, CircleX, Clock3, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ContributionStatus } from '@/lib/calc/types';
import { CONTRIBUTION_STATUS_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Статус взноса значком: подпись и причина отказа уходят в подсказку (§6.3).
 *
 * В таблице взносов статус повторяется в каждой строке, а слова
 * «Ждёт подтверждения» вместе с комментарием администратора занимали больше
 * места, чем сумма и обе даты вместе. Значок говорит то же самое с одного
 * взгляда: форма у каждого статуса своя, поэтому цвет здесь не единственный
 * носитель смысла (§12).
 *
 * Клиентский компонент — ровно ради наведения: подсказка живёт на событиях
 * мыши и фокуса, серверной разметкой её не сделать.
 *
 * Подсказка — добавка, а не единственный путь к тексту: её нет у касания и
 * нет в чтении с экрана. Поэтому подпись со значком едет рядом скрытой
 * строкой, а на узких экранах список показывает статус словами (§12).
 */

const STATUS_ICON: Record<ContributionStatus, LucideIcon> = {
  PENDING: Clock3,
  CONFIRMED: CircleCheck,
  REJECTED: CircleX,
};

/** Тона из палитры §12: спокойный синий у подтверждённого, тёплый — у отказа. */
const STATUS_TONE: Record<ContributionStatus, string> = {
  PENDING: 'text-muted-foreground',
  CONFIRMED: 'text-primary',
  REJECTED: 'text-owes',
};

export function ContributionStatusIcon({
  status,
  comment = null,
  className,
}: {
  status: ContributionStatus;
  /** Комментарий администратора: у отказа это причина. */
  comment?: string | null;
  className?: string;
}): ReactNode {
  const Icon = STATUS_ICON[status];
  const label = CONTRIBUTION_STATUS_LABEL[status];
  const reason = comment === null || comment.trim() === '' ? null : comment.trim();

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'focus-visible:ring-ring inline-flex items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:outline-none active:scale-95',
          STATUS_TONE[status],
          className,
        )}
      >
        <Icon aria-hidden className="size-5" />
        <span className="sr-only">
          {reason === null ? label : `${label}. Причина: ${reason}`}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{label}</p>
        {reason !== null && <p className="text-muted-foreground mt-1">Причина: {reason}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
