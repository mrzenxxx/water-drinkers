import { afterEach, describe, expect, it } from 'vitest';

import {
  fromIsoDate,
  instantToIsoDate,
  toIsoDate,
  toIsoDateOrNull,
  toIsoDateTime,
  todayIso,
} from '@/lib/data/dates';

/**
 * Главный риск слоя дат — часовой пояс. Колонка `DATE` приходит полночью UTC,
 * и локальные геттеры в любой зоне, кроме нулевой, дают соседний день.
 * Поэтому тесты гоняются в заведомо «плохих» зонах по обе стороны Гринвича.
 */
const ORIGINAL_TZ = process.env.TZ;

function inTimeZone(zone: string, body: () => void): void {
  process.env.TZ = zone;
  try {
    body();
  } finally {
    process.env.TZ = ORIGINAL_TZ;
  }
}

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('календарные даты', () => {
  it('переживает круговой перевод в любой зоне', () => {
    const dates = ['2026-01-01', '2026-03-29', '2026-06-01', '2024-02-29', '2026-12-31'];

    for (const zone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Midway', 'Europe/Moscow']) {
      inTimeZone(zone, () => {
        for (const date of dates) {
          expect(toIsoDate(fromIsoDate(date)), `${date} в зоне ${zone}`).toBe(date);
        }
      });
    }
  });

  it('при чтении не съезжает там, где съехали бы локальные геттеры', () => {
    // UTC−11: полночь UTC — это ещё вчерашний вечер по месту, и наивное
    // `value.getDate()` вернуло бы 31 мая вместо 1 июня.
    inTimeZone('Pacific/Midway', () => {
      const stored = fromIsoDate('2026-06-01');
      expect(stored.getDate()).toBe(31);
      expect(toIsoDate(stored)).toBe('2026-06-01');
    });
  });

  it('при записи не съезжает там, где съехал бы локальный конструктор', () => {
    // UTC+14: `new Date(2026, 5, 1)` — это местная полночь, то есть 31 мая
    // 10:00 UTC. Такая дата легла бы в колонку DATE вчерашним днём.
    inTimeZone('Pacific/Kiritimati', () => {
      expect(new Date(2026, 5, 1).toISOString().slice(0, 10)).toBe('2026-05-31');
      expect(fromIsoDate('2026-06-01').toISOString().slice(0, 10)).toBe('2026-06-01');
    });
  });

  it('пишет колонку DATE полночью UTC', () => {
    expect(fromIsoDate('2026-06-01').toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('отвергает мусор вместо даты', () => {
    expect(() => fromIsoDate('01.06.2026')).toThrow(RangeError);
    expect(() => fromIsoDate('2026-02-30')).toThrow(RangeError);
    expect(() => toIsoDate(new Date('нет такой даты'))).toThrow(TypeError);
  });

  it('пропускает null насквозь', () => {
    expect(toIsoDateOrNull(null)).toBeNull();
    expect(toIsoDateOrNull(fromIsoDate('2026-03-08'))).toBe('2026-03-08');
  });
});

describe('моменты времени', () => {
  it('берёт календарный день метки времени в зоне процесса', () => {
    // 01:30 по Москве 2 июня — это 22:30 UTC первого июня.
    inTimeZone('Europe/Moscow', () => {
      expect(instantToIsoDate(new Date('2026-06-01T22:30:00.000Z'))).toBe('2026-06-02');
    });
    inTimeZone('UTC', () => {
      expect(instantToIsoDate(new Date('2026-06-01T22:30:00.000Z'))).toBe('2026-06-01');
    });
  });

  it('отдаёт метку времени в ISO 8601', () => {
    expect(toIsoDateTime(new Date('2026-06-01T22:30:00.000Z'))).toBe('2026-06-01T22:30:00.000Z');
  });

  it('«сегодня» считается от переданных часов, а не от системных', () => {
    inTimeZone('UTC', () => {
      expect(todayIso(new Date('2026-08-14T23:59:59.000Z'))).toBe('2026-08-14');
    });
  });
});
