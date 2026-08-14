import { describe, expect, it } from 'vitest';

import { bucketKeyOf } from '@/lib/view/filters';
import {
  EVENT_KINDS,
  buildEvents,
  filterEvents,
  groupEvents,
  isEventKind,
  type EventSource,
} from '@/lib/view/events';

const SOURCE: EventSource = {
  contributions: [
    { id: 'c1', userId: 'u-1', amount: 50_000, paidAt: '2026-06-03', status: 'CONFIRMED' },
    { id: 'c2', userId: 'u-2', amount: 30_000, paidAt: '2026-06-10', status: 'PENDING' },
  ],
  orders: [{ id: 'o1', amount: 300_000, orderedAt: '2026-06-05', note: 'девять бутылей' }],
  absences: [
    { id: 'a1', userId: 'u-1', type: 'VACATION', startsOn: '2026-06-08', endsOn: '2026-06-20' },
  ],
  transactions: [
    {
      id: 't1',
      type: 'ADJUSTMENT',
      amount: -1_000,
      userId: null,
      occurredOn: '2026-06-05',
      comment: 'опечатка в сумме',
    },
  ],
};

describe('сборка ленты', () => {
  it('сводит четыре таблицы в один поток по дате', () => {
    const events = buildEvents(SOURCE);
    expect(events.map((event) => event.id)).toEqual([
      'contribution:c1',
      'order:o1',
      'transaction:t1',
      'absence:a1',
      'contribution:c2',
    ]);
  });

  it('делает сумму заказа отрицательной: деньги уходят из фонда', () => {
    const order = buildEvents(SOURCE).find((event) => event.kind === 'ORDER');
    expect(order?.amount).toBe(-300_000);
  });

  it('у отсутствия нет суммы, но есть длительность', () => {
    const absence = buildEvents(SOURCE).find((event) => event.kind === 'ABSENCE');
    expect(absence?.amount).toBeNull();
    expect(absence).toMatchObject({ startsOn: '2026-06-08', endsOn: '2026-06-20' });
  });

  it('сортировка детерминирована при совпадении дат', () => {
    const first = buildEvents(SOURCE).map((event) => event.id);
    const shuffled = buildEvents({
      ...SOURCE,
      transactions: [...SOURCE.transactions],
      orders: [...SOURCE.orders],
    }).map((event) => event.id);
    expect(shuffled).toEqual(first);
  });

  it('знает свои типы', () => {
    expect(EVENT_KINDS.every(isEventKind)).toBe(true);
    expect(isEventKind('ЧТО-ТО')).toBe(false);
  });
});

describe('отбор ленты', () => {
  const events = buildEvents(SOURCE);
  const all = { kinds: [...EVENT_KINDS], userIds: [] as string[] };

  it('берёт отсутствие, пересекающее период, а не только лежащее внутри', () => {
    const visible = filterEvents(events, { ...all, from: '2026-06-18', to: '2026-06-25' });
    expect(visible.map((event) => event.id)).toEqual(['absence:a1']);
  });

  it('отбрасывает типы, которых нет в фильтре', () => {
    const visible = filterEvents(events, {
      from: '2026-06-01',
      to: '2026-06-30',
      kinds: ['ORDER'],
      userIds: [],
    });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.kind).toBe('ORDER');
  });

  it('фильтр по участникам не выбрасывает общие события', () => {
    const visible = filterEvents(events, {
      from: '2026-06-01',
      to: '2026-06-30',
      kinds: [...EVENT_KINDS],
      userIds: ['u-2'],
    });
    // Взнос u-2, заказ и корректировка фонда: у последних двух участника нет.
    expect(visible.map((event) => event.id).sort()).toEqual([
      'contribution:c2',
      'order:o1',
      'transaction:t1',
    ]);
  });
});

describe('группировка ленты', () => {
  const events = buildEvents(SOURCE);

  it('складывает события в корзины шага и не создаёт пустых', () => {
    const byWeek = groupEvents(events, bucketKeyOf('week'));
    expect(byWeek.map((bucket) => bucket.key)).toEqual(['2026-06-01', '2026-06-08']);
    expect(byWeek[0]?.events).toHaveLength(3);
    expect(byWeek[1]?.events).toHaveLength(2);
  });

  it('месячная корзина собирает всё в одну', () => {
    const byMonth = groupEvents(events, bucketKeyOf('month'));
    expect(byMonth).toHaveLength(1);
    expect(byMonth[0]?.events).toHaveLength(5);
  });
});
