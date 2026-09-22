'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { EVENT_COLOR, EVENT_LABEL_PLURAL } from '@/components/event-style';
import { PeoplePicker, type PickerPerson } from '@/components/people-picker';
import { Button } from '@/components/ui/button';
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
 * по одному и тому же отрезку. Состояние живёт в адресе страницы, а не в React —
 * §6.9 прямо требует, чтобы диапазоном можно было поделиться ссылкой. Состояние
 * здесь только черновое: включён ли ручной ввод дат и кто отмечен в списке
 * участников до нажатия «Применить».
 *
 * Черновик живёт до смены адреса: страница пересоздаёт панель ключом из
 * запроса, и после любого перехода поля снова показывают то, что в адресе.
 *
 * Панель в три строки: период с датами; участники с кнопками; типы событий
 * с шагом. Все элементы управления одной высоты — 2rem, как поле ввода.
 * Быстрые периоды и шаг — ссылки: один клик, без отправки формы. Всё остальное —
 * обычная `<form method="get">`.
 */
export function DashboardFilters({
  filters,
  people,
}: {
  filters: DashboardFilters;
  people: readonly PickerPerson[];
}): ReactNode {
  const [manual, setManual] = useState(filters.preset === 'custom');
  const peopleLabelId = useId();

  return (
    <form method="get" className="flex flex-col gap-3">
      {/* Ярлык периода едет вместе с формой, пока даты не введены руками:
          иначе «Применить» после смены участников сбрасывал бы период. */}
      {!manual && <input type="hidden" name="period" value={filters.preset} />}
      {filters.granularityPinned && (
        <input type="hidden" name="step" value={filters.granularity} />
      )}

      <Row label="Период">
        <div className="segmented">
          {(['month', 'quarter', 'year', 'all'] as const).map((preset) => {
            const active = !manual && filters.preset === preset;
            return (
              <Link
                key={preset}
                href={dashboardHref(filters, { preset })}
                aria-current={active ? 'true' : undefined}
                className="segment"
                onClick={() => setManual(false)}
              >
                {PERIOD_LABEL[preset]}
              </Link>
            );
          })}
          <button
            type="button"
            aria-pressed={manual}
            className="segment"
            onClick={() => setManual(true)}
          >
            Ручной ввод
          </button>
        </div>

        {/* Выключенные поля не уходят с формой — ровно то, что нужно: даты
            едут в адрес только при ручном вводе. Показывают они при этом
            границы текущего периода. */}
        <div className="flex items-center gap-1.5">
          <DateField name="from" label="Начало периода" value={filters.from} enabled={manual} />
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
          <DateField name="to" label="Конец периода" value={filters.to} enabled={manual} />
        </div>
      </Row>

      <Row label="Участники" labelId={peopleLabelId}>
        <div className="min-w-0 flex-1">
          <PeoplePicker
            name="users"
            people={people}
            defaultValue={filters.userIds}
            labelId={peopleLabelId}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Сбросить</Link>
          </Button>
          <Button type="submit" size="sm">
            Применить
          </Button>
        </div>
      </Row>

      <Row label="События">
        <fieldset className="segmented">
          <legend className="sr-only">Типы событий</legend>
          {FILTER_KINDS.map((kind) => (
            <label key={kind} className="segment">
              <input
                type="checkbox"
                name="kinds"
                value={kind}
                defaultChecked={filters.kinds.includes(kind)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: EVENT_COLOR[kind] }}
              />
              {EVENT_LABEL_PLURAL[kind]}
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Шаг</span>
          <nav aria-label="Шаг сетки" className="segmented">
            <Link
              href={dashboardHref(filters, { granularityPinned: false })}
              aria-current={filters.granularityPinned ? undefined : 'true'}
              title="Подобрать шаг по длине периода"
              className="segment"
            >
              Авто
            </Link>
            {GRANULARITIES.map((step) => (
              <Link
                key={step}
                href={dashboardHref(filters, { granularity: step, granularityPinned: true })}
                aria-current={
                  filters.granularityPinned && filters.granularity === step ? 'true' : undefined
                }
                className="segment"
              >
                {GRANULARITY_LABEL[step]}
              </Link>
            ))}
          </nav>
        </div>

      </Row>
    </form>
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
  name,
  label,
  value,
  enabled,
}: {
  name: string;
  label: string;
  value: string;
  enabled: boolean;
}): ReactNode {
  return (
    <input
      type="date"
      name={name}
      aria-label={label}
      defaultValue={value}
      disabled={!enabled}
      required={enabled}
      className="field-surface focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-36 rounded-md border px-2 text-sm transition-[opacity,border-color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
