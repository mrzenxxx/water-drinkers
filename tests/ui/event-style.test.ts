import { describe, expect, it } from 'vitest';

import { describeEvent } from '@/components/event-style';
import type { NamedUser } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import type { TimelineEvent } from '@/lib/view/events';

/**
 * Строка события собирается из данных, а не из шаблона в разметке: одна и та
 * же фраза нужна и на главной, и в статистике, и разъехавшись, они описывали
 * бы одно событие двумя способами.
 */

const NOBODY: ReadonlyMap<string, NamedUser> = new Map();

function order(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'order:o1',
    kind: 'ORDER',
    startsOn: '2026-06-05',
    endsOn: '2026-06-05',
    amount: -300_000,
    userId: null,
    ...overrides,
  };
}

describe('описание заказа', () => {
  it('сумма в заголовке, штуки — во второй строке', () => {
    // Сумма берётся у `formatKopecks`, а не переписывается строкой: разделитель
    // разрядов там неразрывный, и глазами его от обычного пробела не отличить.
    expect(describeEvent(order({ bottles: 12 }), NOBODY)).toEqual({
      title: `Заказ воды на ${formatKopecks(300_000)}`,
      detail: '12 бутылей',
    });
  });

  it('склоняет «бутыль» по числу', () => {
    const detailOf = (bottles: number): string | null =>
      describeEvent(order({ bottles }), NOBODY).detail;

    expect(detailOf(1)).toBe('1 бутыль');
    expect(detailOf(2)).toBe('2 бутыли');
    expect(detailOf(5)).toBe('5 бутылей');
  });

  it('штуки и примечание стоят в одной строке через точку', () => {
    expect(describeEvent(order({ bottles: 9, note: 'новый поставщик' }), NOBODY).detail).toBe(
      '9 бутылей · новый поставщик',
    );
  });

  it('у заказа без счётчика штук нет — ноль там был бы неправдой', () => {
    expect(describeEvent(order(), NOBODY).detail).toBeNull();
    expect(describeEvent(order({ note: 'только примечание' }), NOBODY).detail).toBe(
      'только примечание',
    );
  });
});
