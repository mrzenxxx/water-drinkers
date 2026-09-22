import { describe, expect, it } from 'vitest';

import {
  daysInMonth,
  formatDate,
  formatDateRange,
  formatDayMonth,
  formatMonth,
  formatMonthShort,
  formatRelativeDate,
  lastDayOfMonth,
  rangesOverlap,
  shiftDateByMonths,
  shiftMonth,
  startOfWeek,
  weekdayIndex,
} from '@/lib/format/dates';
import { formatFileSize, fullName, initials, shortName } from '@/lib/format/labels';
import { DAYS, pluralize, withCount } from '@/lib/format/plural';

describe('даты для экрана', () => {
  it('печатает дату одинаковой ширины', () => {
    expect(formatDate('2026-06-05')).toBe('05.06.2026');
    expect(formatDate('2026-12-31')).toBe('31.12.2026');
  });

  it('склоняет месяц в дате и не склоняет в заголовке', () => {
    expect(formatDayMonth('2026-06-05')).toBe('5 июня');
    expect(formatMonth('2026-06')).toBe('июнь 2026');
    expect(formatMonthShort('2026-06')).toBe('июн 26');
  });

  it('не повторяет общий месяц и год в диапазоне', () => {
    expect(formatDateRange('2026-06-05', '2026-06-07')).toBe('5–7 июня 2026');
    expect(formatDateRange('2026-05-28', '2026-06-03')).toBe('28 мая — 3 июня 2026');
    expect(formatDateRange('2026-12-30', '2027-01-04')).toBe('30 декабря 2026 — 4 января 2027');
    expect(formatDateRange('2026-06-05', '2026-06-05')).toBe('5 июня 2026');
  });

  it('знает вчера, сегодня и завтра относительно переданного дня', () => {
    expect(formatRelativeDate('2026-06-05', '2026-06-05')).toBe('сегодня');
    expect(formatRelativeDate('2026-06-04', '2026-06-05')).toBe('вчера');
    expect(formatRelativeDate('2026-06-06', '2026-06-05')).toBe('завтра');
    expect(formatRelativeDate('2026-06-01', '2026-06-05')).toBe('1 июня');
  });

  it('считает длину месяца, включая високосный февраль', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-06')).toBe(30);
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
  });

  it('сдвигает месяц через границу года', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-06', -14)).toBe('2025-04');
  });

  it('прижимает дату к концу месяца при сдвиге', () => {
    // 31 марта минус месяц — конец февраля, а не 3 марта.
    expect(shiftDateByMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftDateByMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftDateByMonths('2026-06-15', -3)).toBe('2026-03-15');
  });

  it('считает день недели с понедельника', () => {
    // 2026-06-01 — понедельник.
    expect(weekdayIndex('2026-06-01')).toBe(0);
    expect(weekdayIndex('2026-06-07')).toBe(6);
    expect(startOfWeek('2026-06-07')).toBe('2026-06-01');
    expect(startOfWeek('2026-06-08')).toBe('2026-06-08');
  });

  it('видит пересечение включительных отрезков', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-05', '2026-06-09')).toBe(true);
    expect(rangesOverlap('2026-06-01', '2026-06-04', '2026-06-05', '2026-06-09')).toBe(false);
  });
});

describe('склонение', () => {
  it('выбирает форму по последним цифрам', () => {
    expect(pluralize(1, DAYS)).toBe('день');
    expect(pluralize(2, DAYS)).toBe('дня');
    expect(pluralize(5, DAYS)).toBe('дней');
    expect(pluralize(11, DAYS)).toBe('дней');
    expect(pluralize(21, DAYS)).toBe('день');
    expect(pluralize(112, DAYS)).toBe('дней');
    expect(pluralize(0, DAYS)).toBe('дней');
    expect(withCount(3, DAYS)).toBe('3 дня');
  });
});

describe('имена участников', () => {
  it('до заполнения профиля показывает почту', () => {
    expect(fullName({ email: 'i@sspk.spb.ru' })).toBe('i@sspk.spb.ru');
    expect(fullName({ email: 'i@sspk.spb.ru', firstName: 'Иван', lastName: 'Петров' })).toBe(
      'Иван Петров',
    );
  });

  it('сокращает имя для тесных мест', () => {
    expect(shortName({ email: 'i@x', firstName: 'Иван', lastName: 'Петров' })).toBe('И. Петров');
    expect(shortName({ email: 'i@x', lastName: 'Петров' })).toBe('Петров');
    expect(initials({ email: 'iv@x', firstName: 'Иван', lastName: 'Петров' })).toBe('ИП');
    expect(initials({ email: 'iv@x' })).toBe('IV');
  });
});

describe('размер файла', () => {
  it('до килобайта считает в байтах', () => {
    expect(formatFileSize(512)).toBe('512 Б');
  });

  it('килобайты — с одним знаком, пока их мало', () => {
    expect(formatFileSize(1536)).toBe('1,5 КБ');
    expect(formatFileSize(64 * 1024)).toBe('64 КБ');
  });

  it('мегабайты — так же', () => {
    expect(formatFileSize(1024 * 1024 + 512 * 1024)).toBe('1,5 МБ');
  });

  it('десятичный разделитель — запятая, как во всех числах интерфейса', () => {
    expect(formatFileSize(2560)).toContain(',');
  });

  it('не печатает 1024 на стыке единиц: КБ→МБ и МБ→ГБ', () => {
    // При 1048575 (1 МБ - 1 байт) получаем ~1023.999 КБ, который должен
    // округлиться до 1 МБ, а не до 1024 КБ.
    expect(formatFileSize(1048575)).toBe('1 МБ');
    // Симметрично для 1073741823 (1 ГБ - 1 байт): ~1023.999 МБ → 1 ГБ.
    expect(formatFileSize(1073741823)).toBe('1 ГБ');
  });
});
