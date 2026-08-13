import { describe, expect, it } from 'vitest';

import {
  addMoney,
  assertKopecks,
  formatKopecks,
  isKopecks,
  multiplyMoney,
  parseRubles,
  subtractMoney,
  sumBy,
  sumMoney,
  toRublesString,
} from '@/lib/money';

describe('money — kopecks are integers (§2.2)', () => {
  it('accepts safe integers only', () => {
    expect(isKopecks(0)).toBe(true);
    expect(isKopecks(-12345)).toBe(true);
    expect(isKopecks(12.5)).toBe(false);
    expect(isKopecks(Number.NaN)).toBe(false);
    expect(isKopecks(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isKopecks('100')).toBe(false);
  });

  it('rejects fractional amounts loudly', () => {
    expect(() => assertKopecks(10.5)).toThrow(TypeError);
    expect(() => addMoney(1, 2.5)).toThrow(TypeError);
    expect(() => sumMoney([1, Number.NaN])).toThrow(TypeError);
  });

  it('adds without float drift', () => {
    // The canonical float trap: 0.1 + 0.2 !== 0.3 in roubles, exact in kopecks.
    expect(addMoney(10, 20)).toBe(30);
    expect(sumMoney([1, 2, 3, 4, 5])).toBe(15);
    expect(sumMoney([])).toBe(0);
    expect(subtractMoney(500_00, 123_45)).toBe(376_55);
    expect(multiplyMoney(250_00, 12)).toBe(3000_00);
    expect(sumBy([{ a: 100 }, { a: 250 }], (x) => x.a)).toBe(350);
  });
});

describe('money — parsing roubles', () => {
  it('parses the shapes people actually type', () => {
    expect(parseRubles('500')).toBe(50_000);
    expect(parseRubles('500,50')).toBe(50_050);
    expect(parseRubles('500.5')).toBe(50_050);
    expect(parseRubles('1 234,56')).toBe(123_456);
    expect(parseRubles('3 000 ₽')).toBe(300_000);
    expect(parseRubles('1234 руб.')).toBe(123_400);
    expect(parseRubles('-12,05')).toBe(-1_205);
    expect(parseRubles('0,01')).toBe(1);
  });

  it('never silently misreads', () => {
    expect(() => parseRubles('')).toThrow();
    expect(() => parseRubles('abc')).toThrow();
    expect(() => parseRubles('1,234')).toThrow(); // three decimals — not kopecks
    expect(() => parseRubles('1..2')).toThrow();
  });

  it('round-trips through the machine-readable form', () => {
    for (const amount of [0, 1, 99, 100, 123_456, -50_005]) {
      expect(parseRubles(toRublesString(amount))).toBe(amount);
    }
  });
});

const NBSP = '\u00A0';
const MINUS = '\u2212';

describe('money — formatting for display', () => {
  it('renders kopecks as roubles', () => {
    expect(formatKopecks(123_456)).toBe(`1${NBSP}234,56${NBSP}₽`);
    expect(formatKopecks(0)).toBe(`0,00${NBSP}₽`);
    expect(formatKopecks(5)).toBe(`0,05${NBSP}₽`);
    expect(formatKopecks(-34_000)).toBe(`${MINUS}340,00${NBSP}₽`);
    expect(formatKopecks(200_000, { withSymbol: false })).toBe(`2${NBSP}000,00`);
    expect(formatKopecks(42_500, { groupThousands: false })).toBe(`425,00${NBSP}₽`);
    expect(formatKopecks(42_500, { alwaysSign: true })).toBe(`+425,00${NBSP}₽`);
  });
});
