'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useOptimistic, useState, useTransition, type ReactNode } from 'react';

import { EVENT_COLOR, EVENT_LABEL_PLURAL } from '@/components/event-style';
import { PeoplePicker, type PickerPerson } from '@/components/people-picker';
import { isIsoDate } from '@/lib/calc';
import { cn } from '@/lib/utils';
import { EVENT_KINDS, type EventKind } from '@/lib/view/events';
import {
  FILTER_KINDS,
  GRANULARITIES,
  GRANULARITY_LABEL,
  PERIOD_LABEL,
  dashboardHref,
  type DashboardFilters,
} from '@/lib/view/filters';

/**
 * Фильтры дашборда (§6.9).
 *
 * Одна панель над всем, что она задаёт: и лента, и график, и сводка считаются
 * по одному и тому же отрезку. Состояние живёт в адресе страницы — §6.9 прямо
 * требует, чтобы диапазоном можно было поделиться ссылкой.
 *
 * Кнопки «Применить» нет: любое изменение сразу меняет адрес, и сервер
 * пересчитывает экран. Чтобы панель откликалась мгновенно, а не после ответа
 * сервера, выбранное показывается через `useOptimistic`; следующий клик
 * строит адрес от этого же оптимистичного состояния, поэтому быстрые клики
 * подряд не теряют друг друга.
 *
 * Панель в три строки: период с датами; участники; типы событий с шагом.
 * Все элементы управления одной высоты — 2rem, как поле ввода.
 */
export function DashboardFilters({
  filters,
  people,
}: {
  filters: DashboardFilters;
  people: readonly PickerPerson[];
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(
    filters,
    (state, patch: Partial<DashboardFilters>) => ({ ...state, ...patch }),
  );
  const peopleLabelId = useId();

  const [manual, setManual] = useState(filters.preset === 'custom');
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to });

  // Адрес мог смениться мимо панели — кнопкой «назад» в браузере. Тогда
  // режим ввода и черновик дат подстраиваются под него, а не держат старое.
  const [seen, setSeen] = useState(filters);
  if (seen !== filters) {
    setSeen(filters);
    if (seen.preset !== filters.preset) setManual(filters.preset === 'custom');
    if (seen.from !== filters.from || seen.to !== filters.to) {
      setDraft({ from: filters.from, to: filters.to });
    }
  }

  const apply = (patch: Partial<DashboardFilters>): void => {
    startTransition(() => {
      setCurrent(patch);
      router.replace(dashboardHref(current, patch), { scroll: false });
    });
  };

  const changeDate = (edge: 'from' | 'to', value: string): void => {
    const next = { ...draft, [edge]: value };
    setDraft(next);
    // Недонабранная дата приходит пустой строкой — ждём, пока обе будут целыми.
    if (isIsoDate(next.from) && isIsoDate(next.to)) {
      apply({ preset: 'custom', from: next.from, to: next.to });
    }
  };

  const toggleKind = (kind: EventKind): void => {
    const on = new Set(current.kinds);
    if (on.has(kind)) on.delete(kind);
    else on.add(kind);
    apply({ kinds: EVENT_KINDS.filter((item) => on.has(item)) });
  };

  const pickedKinds = FILTER_KINDS.filter((kind) => current.kinds.includes(kind));

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <Row label="Период">
        <div className="segmented" role="group" aria-label="Период">
          {(['month', 'quarter', 'year', 'all'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={!manual && current.preset === preset}
              className="segment"
              onClick={() => {
                setManual(false);
                apply({ preset });
              }}
            >
              {PERIOD_LABEL[preset]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={manual}
            className="segment"
            onClick={() => {
              setDraft({ from: current.from, to: current.to });
              setManual(true);
            }}
          >
            Ручной ввод
          </button>
        </div>

        {/* Поля включаются только в ручном режиме, а в остальных показывают
            границы выбранного периода. */}
        <div className="flex items-center gap-1.5">
          <DateField
            label="Начало периода"
            value={manual ? draft.from : current.from}
            enabled={manual}
            onChange={(value) => changeDate('from', value)}
          />
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
          <DateField
            label="Конец периода"
            value={manual ? draft.to : current.to}
            enabled={manual}
            onChange={(value) => changeDate('to', value)}
          />
        </div>

        <LoaderCircle
          aria-hidden
          className={cn(
            'text-muted-foreground size-4 animate-spin transition-opacity motion-reduce:animate-none',
            pending ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span className="sr-only" aria-live="polite">
          {pending ? 'Обновляю дашборд' : ''}
        </span>
      </Row>

      <Row label="Участники" labelId={peopleLabelId}>
        <PeoplePicker
          people={people}
          value={current.userIds}
          onChange={(userIds) => apply({ userIds })}
          labelId={peopleLabelId}
        />
      </Row>

      <Row label="События">
        <fieldset className="segmented">
          <legend className="sr-only">Типы событий</legend>
          {FILTER_KINDS.map((kind) => {
            const checked = current.kinds.includes(kind);
            return (
              <label key={kind} className="segment">
                <input
                  type="checkbox"
                  checked={checked}
                  // Последний выбранный тип не снимается: пустой выбор означал
                  // бы «все», и щелчок включил бы всё вместо того, чтобы выключить.
                  disabled={checked && pickedKinds.length === 1}
                  onChange={() => toggleKind(kind)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ background: EVENT_COLOR[kind] }}
                />
                {EVENT_LABEL_PLURAL[kind]}
              </label>
            );
          })}
        </fieldset>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Шаг</span>
          <div className="segmented" role="group" aria-label="Шаг сетки">
            <button
              type="button"
              aria-pressed={!current.granularityPinned}
              title="Подобрать шаг по длине периода"
              className="segment"
              onClick={() => apply({ granularityPinned: false })}
            >
              Авто
            </button>
            {GRANULARITIES.map((step) => (
              <button
                key={step}
                type="button"
                aria-pressed={current.granularityPinned && current.granularity === step}
                className="segment"
                onClick={() => apply({ granularity: step, granularityPinned: true })}
              >
                {GRANULARITY_LABEL[step]}
              </button>
            ))}
          </div>
        </div>
      </Row>
    </div>
  );
}

/**
 * Строка панели: подпись слева фиксированной ширины, содержимое справа.
 * Подпись стоит по первой строке содержимого, а не по середине: когда
 * содержимое переносится, подпись по центру повисла бы между строк.
 */
function Row({
  label,
  labelId,
  children,
}: {
  label: string;
  labelId?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span
        id={labelId}
        className="text-muted-foreground flex w-20 shrink-0 items-center text-xs sm:h-8"
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
    </div>
  );
}

function DateField({
  label,
  value,
  enabled,
  onChange,
}: {
  label: string;
  value: string;
  enabled: boolean;
  onChange: (value: string) => void;
}): ReactNode {
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      disabled={!enabled}
      onChange={(event) => onChange(event.target.value)}
      className="field-surface focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-36 rounded-md border px-2 text-sm transition-[opacity,border-color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
