/**
 * Как выглядит и как называется событие ленты.
 *
 * Слот палитры закреплён за типом навсегда (см. `--chart-1..5` в
 * `globals.css`): читатель, запомнивший «заказы — оранжевые», не должен
 * переучиваться после смены фильтра. Цвет при этом никогда не работает
 * в одиночку — рядом всегда подпись типа (§12).
 */

import { ABSENCE_TYPE_LABEL, fullName, type NamedUser } from '@/lib/format';
import { formatDateRange } from '@/lib/format/dates';
import { formatKopecks } from '@/lib/money';
import type { EventKind, TimelineEvent } from '@/lib/view/events';

export const EVENT_LABEL: Record<EventKind, string> = {
  CONTRIBUTION: 'Взнос',
  ORDER: 'Заказ воды',
  ABSENCE: 'Отсутствие',
  SETTLEMENT: 'Выплата',
  ADJUSTMENT: 'Корректировка',
};

/** Множественное число — для легенды и фильтров. */
export const EVENT_LABEL_PLURAL: Record<EventKind, string> = {
  CONTRIBUTION: 'Взносы',
  ORDER: 'Заказы',
  ABSENCE: 'Отсутствия',
  SETTLEMENT: 'Выплаты',
  ADJUSTMENT: 'Корректировки',
};

/** CSS-переменная слота: годится и для `fill` в SVG, и для `background`. */
export const EVENT_COLOR: Record<EventKind, string> = {
  CONTRIBUTION: 'var(--chart-1)',
  ORDER: 'var(--chart-2)',
  ABSENCE: 'var(--chart-3)',
  SETTLEMENT: 'var(--chart-4)',
  ADJUSTMENT: 'var(--chart-5)',
};

/**
 * Строка события для ленты.
 *
 * Собирается из данных, а не из шаблона в разметке: одна и та же фраза нужна
 * и на главной, и на дашборде, и разъехавшись, они описывали бы одно событие
 * двумя способами.
 */
export function describeEvent(
  event: TimelineEvent,
  people: ReadonlyMap<string, NamedUser>,
): { title: string; detail: string | null } {
  const person = event.userId === null ? null : (people.get(event.userId) ?? null);
  const who = person === null ? null : fullName(person);

  switch (event.kind) {
    case 'CONTRIBUTION':
      return {
        title: who === null ? 'Взнос' : `${who} внёс ${formatKopecks(event.amount ?? 0)}`,
        detail: null,
      };

    case 'ORDER':
      return {
        title: `Заказ воды на ${formatKopecks(-(event.amount ?? 0))}`,
        detail: event.note ?? null,
      };

    case 'ABSENCE': {
      const type = event.absenceType === undefined ? 'Отсутствие' : ABSENCE_TYPE_LABEL[event.absenceType];
      return {
        title: who === null ? type : `${who} — ${type.toLowerCase()}`,
        detail: formatDateRange(event.startsOn, event.endsOn),
      };
    }

    case 'SETTLEMENT':
      return {
        title:
          who === null
            ? `Выплата ${formatKopecks(event.amount ?? 0)}`
            : `${who}: выплата остатка ${formatKopecks(event.amount ?? 0)}`,
        detail: event.note ?? null,
      };

    case 'ADJUSTMENT':
      return {
        title:
          who === null
            ? // Корректировка без участника раскладывается поровну между
              // активными на дату операции (§2.4) — это стоит сказать вслух.
              `Корректировка фонда ${formatKopecks(event.amount ?? 0, { alwaysSign: true })}`
            : `${who}: корректировка ${formatKopecks(event.amount ?? 0, { alwaysSign: true })}`,
        detail: event.note ?? null,
      };
  }
}
