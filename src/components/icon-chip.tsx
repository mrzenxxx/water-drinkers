import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Значок в стеклянной фишке — опознавательный знак раздела или карточки.
 *
 * Всегда декоративен: рядом стоит заголовок, который значок лишь повторяет.
 * Поэтому он спрятан от чтения с экрана — иначе читалка произносила бы одно
 * и то же дважды. Если значку понадобится сказать что-то своё, ему нужна
 * подпись, а не эта фишка.
 *
 * Два размера и два тона: «водный» для обычных разделов и «долг» для
 * тёплого акцента там, где речь о задолженности. Тон дублирует то, что уже
 * сказано словами и знаком числа (§12).
 */
export function IconChip({
  icon: Icon,
  tone = 'water',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: 'water' | 'owes';
  size?: 'sm' | 'md';
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        'glass-soft flex shrink-0 items-center justify-center rounded-xl',
        size === 'md' ? 'size-10' : 'size-8',
        tone === 'owes' ? 'text-owes' : 'text-primary',
        className,
      )}
    >
      <Icon aria-hidden className={size === 'md' ? 'size-5' : 'size-4'} />
    </span>
  );
}
