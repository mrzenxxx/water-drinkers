import { describe, expect, it } from 'vitest';

import { eventDetails } from '@/components/event-style';
import type { NamedUser } from '@/lib/format';
import { buildEvents, type TimelineEvent } from '@/lib/view/events';

const PEOPLE = new Map<string, NamedUser>([
  ['u-1', { login: 'd.volkov', firstName: 'Дмитрий', lastName: 'Волков' }],
  ['u-2', { login: 's.gusev', firstName: 'Сергей', lastName: 'Гусев' }],
  ['admin', { login: 'e.kondobarov', firstName: 'Евгений', lastName: 'Кондобаров' }],
]);

const base = { startsOn: '2026-07-03', endsOn: '2026-07-03' } as const;

describe('карточка события для подсказки графика', () => {
  it('у взноса называет того, кто внёс, сумму и статус', () => {
    const details = eventDetails(
      { ...base, id: 'c', kind: 'CONTRIBUTION', amount: 50_000, userId: 'u-1', status: 'PENDING' },
      PEOPLE,
    );

    expect(details.label).toBe('Взнос');
    expect(details.when).toBe('03.07.2026');
    expect(details.rows).toEqual([
      { label: 'Внёс', value: 'Дмитрий Волков' },
      { label: 'Сумма', value: expect.stringContaining('500') },
      { label: 'Статус', value: 'Ждёт подтверждения' },
    ]);
  });

  it('у заказа называет того, кто его оформил', () => {
    const [order] = buildEvents({
      contributions: [],
      orders: [{ id: 'o', amount: 330_000, orderedAt: '2026-07-03', note: '10 бутылей', createdBy: 'admin' }],
      absences: [],
      transactions: [],
    });

    const details = eventDetails(order!, PEOPLE);
    expect(details.rows).toEqual([
      { label: 'Сумма', value: expect.stringContaining('3') },
      { label: 'Оформил', value: 'Евгений Кондобаров' },
      { label: 'Заметка', value: '10 бутылей' },
    ]);
    // Сумма заказа в карточке положительна: знак несёт тип события.
    expect(details.rows[0]!.value).not.toMatch(/^[−-]/);
  });

  it('у отсутствия называет отсутствовавшего, причину и длительность', () => {
    const event: TimelineEvent = {
      id: 'a',
      kind: 'ABSENCE',
      startsOn: '2026-07-01',
      endsOn: '2026-07-14',
      amount: null,
      userId: 'u-2',
      absenceType: 'VACATION',
    };

    const details = eventDetails(event, PEOPLE);
    expect(details.when).not.toBe('01.07.2026');
    expect(details.rows).toEqual([
      { label: 'Отсутствовал', value: 'Сергей Гусев' },
      { label: 'Причина', value: 'Отпуск' },
      { label: 'Длительность', value: '14 дней' },
    ]);
  });

  it('у общей корректировки говорит, что она касается всего фонда, и кто её провёл', () => {
    const [adjustment] = buildEvents({
      contributions: [],
      orders: [],
      absences: [],
      transactions: [
        {
          id: 't',
          type: 'ADJUSTMENT',
          amount: -1_000,
          userId: null,
          occurredOn: '2026-07-03',
          comment: 'Ошибка в чеке',
          createdBy: 'admin',
        },
      ],
    });

    expect(eventDetails(adjustment!, PEOPLE).rows).toEqual([
      { label: 'Кого касается', value: 'Весь фонд' },
      { label: 'Сумма', value: expect.stringMatching(/^[−-]/) },
      { label: 'Провёл', value: 'Евгений Кондобаров' },
      { label: 'Комментарий', value: 'Ошибка в чеке' },
    ]);
  });

  it('пропускает поля, которых нет, а не пишет пустые строки', () => {
    const details = eventDetails(
      { ...base, id: 'o', kind: 'ORDER', amount: -1_000, userId: null, actorId: 'unknown' },
      PEOPLE,
    );
    expect(details.rows.map((row) => row.label)).toEqual(['Сумма']);
  });
});
