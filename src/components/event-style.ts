/**
 * Как выглядит и как называется событие ленты.
 *
 * Слот палитры закреплён за типом навсегда (см. `--chart-1..5` в
 * `globals.css`): читатель, запомнивший «заказы — оранжевые», не должен
 * переучиваться после смены фильтра. Цвет при этом никогда не работает
 * в одиночку — рядом всегда подпись типа (§12).
 */

import { toEpochDay } from '@/lib/calc';
import {
  ABSENCE_TYPE_LABEL,
  CONTRIBUTION_STATUS_LABEL,
  DAYS,
  formatDate,
  fullName,
  withCount,
  type NamedUser,
} from '@/lib/format';
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

/** Строка карточки события: подпись и значение. */
export type EventDetailRow = { label: string; value: string };

/** Всё, что подсказка графика говорит о событии. */
export type EventDetails = {
  kind: EventKind;
  /** «Взнос», «Заказ воды»… — тип события, а не его описание. */
  label: string;
  /** Дата, у отсутствия — период. */
  when: string;
  rows: EventDetailRow[];
};

/**
 * Карточка события для подсказки при наведении на график.
 *
 * `describeEvent` даёт одну фразу для ленты; здесь то же событие разложено
 * по полям: кто внёс, кто отсутствовал, кто оформил заказ или провёл
 * операцию. Функция чистая, поэтому набор полей проверяется тестом.
 */
export function eventDetails(
  event: TimelineEvent,
  people: ReadonlyMap<string, NamedUser>,
): EventDetails {
  const nameOf = (id: string | null | undefined): string | null => {
    if (id === null || id === undefined) return null;
    const person = people.get(id);
    return person === undefined ? null : fullName(person);
  };

  const who = nameOf(event.userId);
  const actor = nameOf(event.actorId);
  const rows: EventDetailRow[] = [];
  const push = (label: string, value: string | null | undefined): void => {
    if (value !== null && value !== undefined && value.trim() !== '') rows.push({ label, value });
  };

  switch (event.kind) {
    case 'CONTRIBUTION':
      push('Внёс', who);
      push('Сумма', formatKopecks(event.amount ?? 0));
      push('Статус', event.status === undefined ? null : CONTRIBUTION_STATUS_LABEL[event.status]);
      break;

    case 'ORDER':
      push('Сумма', formatKopecks(-(event.amount ?? 0)));
      push('Оформил', actor);
      push('Заметка', event.note);
      break;

    case 'ABSENCE': {
      const days = toEpochDay(event.endsOn) - toEpochDay(event.startsOn) + 1;
      push('Отсутствовал', who);
      push('Причина', event.absenceType === undefined ? null : ABSENCE_TYPE_LABEL[event.absenceType]);
      push('Длительность', withCount(days, DAYS));
      break;
    }

    case 'SETTLEMENT':
      push('Кому', who);
      push('Сумма', formatKopecks(event.amount ?? 0));
      push('Провёл', actor);
      push('Комментарий', event.note);
      break;

    case 'ADJUSTMENT':
      // Корректировка без участника раскладывается на всех активных (§2.4).
      push('Кого касается', who ?? 'Весь фонд');
      push('Сумма', formatKopecks(event.amount ?? 0, { alwaysSign: true }));
      push('Провёл', actor);
      push('Комментарий', event.note);
      break;
  }

  return {
    kind: event.kind,
    label: EVENT_LABEL[event.kind],
    when:
      event.startsOn === event.endsOn
        ? formatDate(event.startsOn)
        : formatDateRange(event.startsOn, event.endsOn),
    rows,
  };
}
