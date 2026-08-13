/**
 * Money primitives.
 *
 * SPEC §2.2: every monetary value is an integer number of kopecks. Floating point
 * is forbidden in monetary arithmetic — the invariant of §5 requires exact
 * equality, and `0.1 + 0.2 !== 0.3`. Conversion to roubles happens only in the
 * presentation layer, i.e. in `formatKopecks`.
 *
 * Everything here is pure: no I/O, no clock, no global state.
 */

/** An integer amount of kopecks. May be negative (debts, outgoing transactions). */
export type Kopecks = number;

const KOPECKS_IN_ROUBLE = 100;

/** Narrow, exact test for a value usable as money. */
export function isKopecks(value: unknown): value is Kopecks {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws unless `value` is a safe integer amount of kopecks. */
export function assertKopecks(value: unknown, what = 'amount'): asserts value is Kopecks {
  if (!isKopecks(value)) {
    throw new TypeError(`${what} must be a safe integer number of kopecks, got ${String(value)}`);
  }
}

/** Adds amounts, verifying every operand and the result stay exact integers. */
export function addMoney(...amounts: readonly Kopecks[]): Kopecks {
  let total = 0;
  for (const amount of amounts) {
    assertKopecks(amount, 'operand');
    total += amount;
  }
  assertKopecks(total, 'sum');
  return total;
}

/** Sums an iterable of amounts. Empty input sums to zero. */
export function sumMoney(amounts: Iterable<Kopecks>): Kopecks {
  let total = 0;
  for (const amount of amounts) {
    assertKopecks(amount, 'operand');
    total += amount;
  }
  assertKopecks(total, 'sum');
  return total;
}

/** Sums a projection over a collection, e.g. `sumBy(orders, (o) => o.amount)`. */
export function sumBy<T>(items: Iterable<T>, select: (item: T) => Kopecks): Kopecks {
  let total = 0;
  for (const item of items) {
    const amount = select(item);
    assertKopecks(amount, 'operand');
    total += amount;
  }
  assertKopecks(total, 'sum');
  return total;
}

/** `a − b`, both in kopecks. */
export function subtractMoney(a: Kopecks, b: Kopecks): Kopecks {
  assertKopecks(a, 'minuend');
  assertKopecks(b, 'subtrahend');
  const result = a - b;
  assertKopecks(result, 'difference');
  return result;
}

/** Multiplies an amount by an integer factor (e.g. bottle count). */
export function multiplyMoney(amount: Kopecks, factor: number): Kopecks {
  assertKopecks(amount, 'amount');
  if (!Number.isSafeInteger(factor)) {
    throw new TypeError(`factor must be an integer, got ${String(factor)}`);
  }
  const result = amount * factor;
  assertKopecks(result, 'product');
  return result;
}

export function isDebt(amount: Kopecks): boolean {
  assertKopecks(amount, 'amount');
  return amount < 0;
}

const ROUBLES_PATTERN = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses a human-written rouble amount into kopecks, without ever touching a
 * float. Accepts `"1234"`, `"1 234,56"`, `"1234.5"`, `"-12,05"`, `"3 000 ₽"`,
 * thin/non-breaking spaces and an optional `руб.` suffix.
 *
 * Throws on anything it cannot read exactly — silent misreads are worse than a
 * loud failure when the number is money.
 */
export function parseRubles(input: string): Kopecks {
  if (typeof input !== 'string') {
    throw new TypeError(`expected a string amount, got ${typeof input}`);
  }

  const normalized = input
    .replace(/[\s   ]/g, '')
    .replace(/(?:₽|руб\.?|rub\.?|r\.?)$/i, '')
    .trim();

  const match = ROUBLES_PATTERN.exec(normalized);
  if (!match) {
    throw new RangeError(`cannot parse "${input}" as a rouble amount`);
  }

  const [, sign, wholePart, fractionPart = ''] = match;
  const kopecksPart = fractionPart.padEnd(2, '0');

  const whole = Number(wholePart);
  const fraction = Number(kopecksPart);
  const magnitude = whole * KOPECKS_IN_ROUBLE + fraction;
  assertKopecks(magnitude, 'parsed amount');

  return sign === '-' ? -magnitude : magnitude;
}

export type FormatOptions = {
  /** Append the ₽ sign. Default `true`. */
  withSymbol?: boolean;
  /** Group thousands with a non-breaking space. Default `true`. */
  groupThousands?: boolean;
  /** Always show a leading `+` for positive amounts. Default `false`. */
  alwaysSign?: boolean;
};

/**
 * Renders kopecks as roubles for display: `123456` → `"1 234,56 ₽"`.
 * Integer arithmetic only — the fractional part is produced by `%`, not division.
 */
export function formatKopecks(amount: Kopecks, options: FormatOptions = {}): string {
  assertKopecks(amount, 'amount');
  const { withSymbol = true, groupThousands = true, alwaysSign = false } = options;

  const negative = amount < 0;
  const magnitude = Math.abs(amount);
  const whole = (magnitude - (magnitude % KOPECKS_IN_ROUBLE)) / KOPECKS_IN_ROUBLE;
  const fraction = magnitude % KOPECKS_IN_ROUBLE;

  const wholeText = groupThousands
    ? String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : String(whole);
  const fractionText = String(fraction).padStart(2, '0');

  const sign = negative ? '−' : alwaysSign ? '+' : '';
  const body = `${sign}${wholeText},${fractionText}`;

  return withSymbol ? `${body} ₽` : body;
}

/** `12345` → `"123.45"` — machine-readable roubles, e.g. for exports. */
export function toRublesString(amount: Kopecks): string {
  assertKopecks(amount, 'amount');
  const negative = amount < 0;
  const magnitude = Math.abs(amount);
  const whole = (magnitude - (magnitude % KOPECKS_IN_ROUBLE)) / KOPECKS_IN_ROUBLE;
  const fraction = magnitude % KOPECKS_IN_ROUBLE;
  return `${negative ? '-' : ''}${whole}.${String(fraction).padStart(2, '0')}`;
}
