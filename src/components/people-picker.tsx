'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type PickerPerson = { id: string; name: string };

/**
 * Выбор участников тегами.
 *
 * Поле показывает выбранных облаком тегов с крестиком; щелчок по полю
 * раскрывает список с галочками. Пустой выбор значит «все» — так же, как
 * в адресе дашборда, — и тогда в поле стоит единственный тег «Все участники»
 * без крестика: убирать там нечего.
 *
 * Компонент управляемый: выбор приходит в `value` и уходит в `onChange`
 * на каждую галочку и каждый крестик. Хранит он только своё — открыт ли
 * список и что набрано в поиске.
 *
 * Поле шириной по содержимому: растёт вместе с тегами и переносит их на
 * следующую строку, только упёршись в край.
 */
export function PeoplePicker({
  people,
  value,
  onChange,
  labelId,
}: {
  people: readonly PickerPerson[];
  /** Выбранные; пустой список — все. */
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** `id` видимой подписи поля — для `aria-labelledby`. */
  labelId: string;
}): ReactNode {
  const known = new Set(people.map((person) => person.id));
  const selected = value.filter((id) => known.has(id));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);

  const chosen = people.filter((person) => selected.includes(person.id));
  const needle = query.trim().toLocaleLowerCase('ru');
  const shown =
    needle === ''
      ? people
      : people.filter((person) => person.name.toLocaleLowerCase('ru').includes(needle));

  const toggle = (id: string): void => {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    // Отмеченные поимённо все — это и есть «все»: адрес остаётся коротким.
    onChange(next.length === people.length ? [] : next);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setQuery('');
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={fieldRef}
          className={cn(
            'field-surface inline-flex min-h-8 max-w-full min-w-0 flex-wrap items-center gap-1 rounded-md border p-[4px] text-sm transition-[border-color,box-shadow]',
            open && 'border-ring ring-ring/50 ring-[3px]',
          )}
          // Всё поле раскрывает список, кроме кнопок: у крестика и стрелки своя работа.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button') === null) setOpen(true);
          }}
        >
          {chosen.length === 0 ? (
            <span className="tag">Все участники</span>
          ) : (
            chosen.map((person) => (
              <span key={person.id} className="tag">
                {person.name}
                <button
                  type="button"
                  aria-label={`Убрать: ${person.name}`}
                  className="hover:bg-foreground/10 focus-visible:ring-ring -mr-1 grid size-4 place-items-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(person.id);
                  }}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            ))
          )}

          <PopoverPrimitive.Trigger
            aria-labelledby={labelId}
            aria-controls={open ? listId : undefined}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-[1.375rem] w-6 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform', open && 'rotate-180')}
            />
          </PopoverPrimitive.Trigger>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          // Щелчок по полю — не «снаружи»: иначе снятие тега закрывало бы список.
          onInteractOutside={(event) => {
            if (fieldRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          // Подложка непрозрачная: список лежит поверх текста панели, и стекло
          // пустило бы его в строки с именами.
          className="bg-popover text-popover-foreground z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border p-1 text-sm shadow-lg"
        >
          {people.length > 7 && (
            <label className="field-surface mb-1 flex h-8 items-center gap-2 rounded-md border px-2">
              <Search aria-hidden className="text-muted-foreground size-3.5" />
              <span className="sr-only">Найти участника</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти участника"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          )}

          <ul id={listId} className="max-h-64 overflow-y-auto" aria-label="Участники">
            {needle === '' && (
              <li>
                <PickRow checked={selected.length === 0} onToggle={() => onChange([])}>
                  Все участники
                </PickRow>
                <div role="separator" className="bg-border my-1 h-px" />
              </li>
            )}
            {shown.map((person) => (
              <li key={person.id}>
                <PickRow
                  checked={selected.includes(person.id)}
                  onToggle={() => toggle(person.id)}
                >
                  {person.name}
                </PickRow>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-muted-foreground px-2 py-1.5">Никого не нашлось</li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function PickRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="hover:bg-foreground/5 focus-visible:bg-foreground/5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none"
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-[4px] border',
          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
