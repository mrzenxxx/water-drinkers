import Link from 'next/link';
import type { ReactNode } from 'react';

import { EVENT_COLOR, EVENT_LABEL_PLURAL } from '@/components/event-style';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PersonRow } from '@/lib/data/queries';
import { fullName } from '@/lib/format';
import { EVENT_KINDS } from '@/lib/view/events';
import {
  GRANULARITIES,
  GRANULARITY_LABEL,
  PERIOD_LABEL,
  dashboardHref,
  type DashboardFilters,
} from '@/lib/view/filters';
import { cn } from '@/lib/utils';

/**
 * Фильтры дашборда (§6.9).
 *
 * Одна панель над всем, что она задаёт: и лента, и график, и сводка считаются
 * по одному и тому же отрезку. Состояние живёт в адресе страницы, а не в React —
 * §6.9 прямо требует, чтобы диапазоном можно было поделиться ссылкой.
 *
 * Быстрые периоды и шаг сделаны ссылками: один клик, без отправки формы.
 * Произвольный диапазон, участники и типы — обычная `<form method="get">`,
 * которая работает и без JavaScript.
 */
export function DashboardFilters({
  filters,
  people,
}: {
  filters: DashboardFilters;
  people: readonly PersonRow[];
}): ReactNode {
  const pill = (active: boolean): string =>
    cn(
      'focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
      active
        ? 'bg-primary text-primary-foreground font-medium'
        : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
    );

  return (
    <div className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-full text-xs sm:w-auto">Период</span>
        {(['month', 'quarter', 'year', 'all'] as const).map((preset) => (
          <Link
            key={preset}
            href={dashboardHref(filters, { preset })}
            aria-current={filters.preset === preset ? 'true' : undefined}
            className={pill(filters.preset === preset)}
          >
            {PERIOD_LABEL[preset]}
          </Link>
        ))}
        {filters.preset === 'custom' && (
          <span className={pill(true)}>{PERIOD_LABEL.custom}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-full text-xs sm:w-auto">Шаг</span>
        {GRANULARITIES.map((step) => (
          <Link
            key={step}
            href={dashboardHref(filters, { granularity: step, granularityPinned: true })}
            aria-current={filters.granularity === step ? 'true' : undefined}
            className={pill(filters.granularity === step)}
          >
            {GRANULARITY_LABEL[step]}
          </Link>
        ))}
        {filters.granularityPinned && (
          <Link
            href={dashboardHref(filters, { granularityPinned: false })}
            className="text-muted-foreground text-xs underline underline-offset-4"
          >
            подобрать по длине периода
          </Link>
        )}
      </div>

      <form method="get" className="grid gap-4 lg:grid-cols-4">
        {/* Ярлык периода едет вместе с формой: без него произвольные даты,
            стёртые пользователем, вернули бы период по умолчанию. */}
        {filters.preset !== 'custom' && (
          <input type="hidden" name="period" value={filters.preset} />
        )}
        {filters.granularityPinned && (
          <input type="hidden" name="step" value={filters.granularity} />
        )}

        <div className="space-y-2">
          <Label htmlFor="from">Произвольный период: с</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.preset === 'custom' ? filters.from : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">по</Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.preset === 'custom' ? filters.to : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="users">Участники</Label>
          <select
            id="users"
            name="users"
            multiple
            size={4}
            defaultValue={filters.userIds}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {fullName(person)}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Ничего не выбрано — показываем всех. Заказы и общие корректировки касаются всех
            и остаются в ленте всегда.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Типы событий</legend>
          {EVENT_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="kinds"
                value={kind}
                defaultChecked={filters.kinds.includes(kind)}
                className="accent-primary size-4"
              />
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-full"
                style={{ background: EVENT_COLOR[kind] }}
              />
              {EVENT_LABEL_PLURAL[kind]}
            </label>
          ))}
        </fieldset>

        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="submit">Применить</Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Сбросить</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
