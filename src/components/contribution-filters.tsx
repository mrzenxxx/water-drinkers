'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition, type ReactNode } from 'react';

import { DateField, FilterRow, PendingMark } from '@/components/filter-panel';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { isIsoDate } from '@/lib/calc';
import { CONTRIBUTION_STATUS_LABEL } from '@/lib/format';
import {
  CONTRIBUTION_STATUSES,
  EMPTY_CONTRIBUTION_FILTERS,
  contributionsHref,
  hasContributionFilters,
  type ContributionFilters as Filters,
} from '@/lib/view/filters';

/**
 * Отбор всех взносов (§6.3) — так же, как фильтры статистики (§6.9).
 *
 * Кнопки «Показать» нет: любое изменение сразу меняет адрес, и сервер
 * пересчитывает таблицу. Выбранное показывается через `useOptimistic`, чтобы
 * панель откликалась мгновенно; следующий клик строит адрес от этого же
 * оптимистичного состояния, и быстрые клики подряд не теряют друг друга.
 * Состояние по-прежнему живёт в адресе — ссылкой можно поделиться.
 */
export function ContributionFilters({
  filters,
  people,
}: {
  filters: Filters;
  people: readonly { id: string; name: string }[];
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(filters, (state, patch: Partial<Filters>) => ({
    ...state,
    ...patch,
  }));

  // Черновик дат: пока дата недонабрана, поле держит своё, а адрес не трогаем.
  const [draft, setDraft] = useState({ from: filters.from ?? '', to: filters.to ?? '' });
  // Адрес мог смениться мимо панели — «назад» в браузере или «Сбросить».
  const [seen, setSeen] = useState(filters);
  if (seen !== filters) {
    setSeen(filters);
    setDraft({ from: filters.from ?? '', to: filters.to ?? '' });
  }

  const apply = (patch: Partial<Filters>): void => {
    startTransition(() => {
      setCurrent(patch);
      router.replace(contributionsHref(current, patch), { scroll: false });
    });
  };

  const changeDate = (edge: 'from' | 'to', value: string): void => {
    setDraft({ ...draft, [edge]: value });
    // Пустое поле — граница снята; недонабранная дата адрес не меняет.
    if (value === '') apply({ [edge]: null });
    else if (isIsoDate(value)) apply({ [edge]: value });
  };

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <FilterRow label="Участник" aside={<PendingMark pending={pending} text="Обновляю список взносов" />}>
        <NativeSelect
          aria-label="Участник"
          value={current.userId ?? ''}
          onChange={(event) => apply({ userId: event.target.value === '' ? null : event.target.value })}
          className="control-compact h-(--control-h) sm:w-72"
        >
          <option value="">Все участники</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </NativeSelect>
      </FilterRow>

      <FilterRow label="Статус">
        {/* На телефоне пять сегментов в строку не влезают — там сетка в две
            колонки, а «Любой» занимает всю первую строку. */}
        <div className="segmented grid w-full grid-cols-2 sm:inline-flex sm:w-auto" role="group" aria-label="Статус">
          <button
            type="button"
            aria-pressed={current.status === null}
            className="segment col-span-2"
            onClick={() => apply({ status: null })}
          >
            Любой
          </button>
          {CONTRIBUTION_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={current.status === status}
              className="segment"
              onClick={() => apply({ status })}
            >
              {CONTRIBUTION_STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </FilterRow>

      <FilterRow label="Платёж">
        {/* На телефоне поля делят строку поровну. */}
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:w-auto">
          <DateField label="Платёж с" value={draft.from} onChange={(value) => changeDate('from', value)} />
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
          <DateField label="Платёж по" value={draft.to} onChange={(value) => changeDate('to', value)} />
        </div>

        {hasContributionFilters(current) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="control-compact h-(--control-h)"
            onClick={() => apply(EMPTY_CONTRIBUTION_FILTERS)}
          >
            Сбросить
          </Button>
        )}
      </FilterRow>
    </div>
  );
}
