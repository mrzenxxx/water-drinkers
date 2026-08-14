/**
 * Скаляры — граница типов приложения (§10.2).
 *
 * Проверяется главным образом то, чего они делать **не** должны: молча
 * подставлять ноль вместо дробной суммы и пустую строку вместо даты. Такая
 * снисходительность опаснее отказа — запрос проходит, а в базу уезжает
 * неправда, и инвариант §5 ломается там, где его никто не ищет.
 */

import { Kind } from 'graphql';
import { describe, expect, it } from 'vitest';

import { DateScalar, DateTimeScalar, MoneyScalar } from '@/graphql/scalars';

describe('Money', () => {
  it('принимает целое число копеек', () => {
    expect(MoneyScalar.parseValue(50000)).toBe(50000);
    expect(MoneyScalar.parseValue(-12345)).toBe(-12345);
    expect(MoneyScalar.parseValue(0)).toBe(0);
  });

  it('отвергает дробную сумму, а не округляет её', () => {
    expect(() => MoneyScalar.parseValue(250.5)).toThrow(/целым числом копеек/);
  });

  it('отвергает дробный литерал вместо того, чтобы вернуть ноль', () => {
    // Прежняя реализация на этом молча возвращала 0: сумма исчезала бесследно.
    expect(() => MoneyScalar.parseLiteral({ kind: Kind.FLOAT, value: '250.50' })).toThrow(/рублями/);
  });

  it('отвергает строку и null', () => {
    expect(() => MoneyScalar.parseValue('50000')).toThrow();
    expect(() => MoneyScalar.parseValue(null)).toThrow();
    expect(() => MoneyScalar.parseValue(true)).toThrow();
  });

  it('принимает целый литерал, включая отрицательный', () => {
    expect(MoneyScalar.parseLiteral({ kind: Kind.INT, value: '50000' })).toBe(50000);
    expect(MoneyScalar.parseLiteral({ kind: Kind.INT, value: '-50000' })).toBe(-50000);
  });

  it('отвергает целое за пределами точности', () => {
    expect(() => MoneyScalar.parseLiteral({ kind: Kind.INT, value: '99999999999999999999' })).toThrow(/диапазона/);
  });

  it('на выходе не пропускает дробное значение', () => {
    expect(MoneyScalar.serialize(50000)).toBe(50000);
    expect(() => MoneyScalar.serialize(250.5)).toThrow(/целым числом копеек/);
    expect(() => MoneyScalar.serialize(Number.NaN)).toThrow();
  });

  it('на выходе принимает BigInt из базы', () => {
    // BIGINT приезжает из Prisma как bigint; резолверы переводят его сами,
    // но граница не должна разваливаться, если один из них об этом забудет.
    expect(MoneyScalar.serialize(50000n)).toBe(50000);
  });
});

describe('Date', () => {
  it('принимает YYYY-MM-DD', () => {
    expect(DateScalar.parseValue('2026-08-14')).toBe('2026-08-14');
    expect(DateScalar.parseLiteral({ kind: Kind.STRING, value: '2026-08-14' })).toBe('2026-08-14');
  });

  it('отвергает русский формат и мусор', () => {
    expect(() => DateScalar.parseValue('14.08.2026')).toThrow(/YYYY-MM-DD/);
    expect(() => DateScalar.parseValue('2026-13-01')).toThrow();
    expect(() => DateScalar.parseValue('')).toThrow();
  });

  it('отвергает нестроковый литерал вместо того, чтобы вернуть пустую строку', () => {
    expect(() => DateScalar.parseLiteral({ kind: Kind.INT, value: '20260814' })).toThrow();
  });

  it('на выходе не пропускает объект Date', () => {
    // Резолверы обязаны перевести DATE в строку сами (`toIsoDate`).
    expect(() => DateScalar.serialize(new Date('2026-08-14'))).toThrow(/YYYY-MM-DD/);
  });
});

describe('DateTime', () => {
  it('принимает ISO 8601', () => {
    expect(DateTimeScalar.parseValue('2026-08-14T10:00:00.000Z')).toBe('2026-08-14T10:00:00.000Z');
  });

  it('отвергает нечитаемый момент времени', () => {
    expect(() => DateTimeScalar.parseValue('вчера')).toThrow(/ISO 8601/);
    expect(() => DateTimeScalar.serialize(1_760_000_000_000)).toThrow();
  });
});
