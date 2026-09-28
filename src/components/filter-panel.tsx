import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Общие детали панелей фильтров — статистики (§6.9) и всех взносов (§6.3).
 * Обе панели устроены одинаково: строки с подписью слева на широком экране
 * и сверху на узком, элементы управления одной высоты (`--control-h`).
 */

/**
 * Строка панели: подпись и содержимое. На широком экране подпись слева
 * фиксированной ширины, ниже 1024px — над содержимым.
 * Подпись стоит по первой строке содержимого, а не по середине: когда
 * содержимое переносится, подпись по центру повисла бы между строк.
 */
export function FilterRow({
  label,
  labelId,
  aside,
  children,
}: {
  label: string;
  labelId?: string;
  /** Мелочь рядом с подписью — например, индикатор обновления. */
  aside?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-3">
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs lg:h-(--control-h) lg:w-20">
        <span id={labelId}>{label}</span>
        {aside}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
    </div>
  );
}

/** Крутилка «пересчитываю» рядом с подписью строки и её голос для чтения с экрана. */
export function PendingMark({ pending, text }: { pending: boolean; text: string }): ReactNode {
  return (
    <>
      <LoaderCircle
        aria-hidden
        className={cn(
          'size-3.5 animate-spin transition-opacity motion-reduce:animate-none',
          pending ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span className="sr-only" aria-live="polite">
        {pending ? text : ''}
      </span>
    </>
  );
}

/**
 * Поле даты панели. Шрифт на телефоне — 16px: Safari на iPhone увеличивает
 * страницу, если в поле с шрифтом мельче нажать пальцем, и панель уезжает
 * за край экрана.
 */
export function DateField({
  label,
  value,
  enabled = true,
  onChange,
}: {
  label: string;
  value: string;
  enabled?: boolean;
  onChange: (value: string) => void;
}): ReactNode {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      disabled={!enabled}
      onChange={(event) => onChange(event.target.value)}
      className="field-surface h-(--control-h) w-full min-w-0 rounded-md border px-2 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-36 md:text-sm"
    />
  );
}
