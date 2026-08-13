/**
 * Calendar arithmetic for the calculation core (SPEC §4.1).
 *
 * Dates are `YYYY-MM-DD` strings and are converted to a day index with Howard
 * Hinnant's civil-calendar algorithm. No `Date` object is involved anywhere, so
 * there is no timezone, no DST and no hidden clock — `daysPresent` is a pure
 * function of its arguments.
 *
 * Granularity is one calendar day; weekends and holidays are not special (§4.1).
 * All internal intervals are half-open `[from, to)`, matching the notation of the
 * spec. `Absence`, by contrast, is stored with **both ends inclusive**, and is
 * converted here.
 */

import type { Absence, DateRange, IsoDate, Participant } from './types';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

export type CivilDate = { year: number; month: number; day: number };

/** Parses `YYYY-MM-DD` and rejects impossible dates such as `2026-02-30`. */
export function parseIsoDate(value: IsoDate): CivilDate {
  if (typeof value !== 'string') {
    throw new TypeError(`expected an ISO date string, got ${typeof value}`);
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`"${value}" is not a YYYY-MM-DD date`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    throw new RangeError(`"${value}" has an invalid month`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`"${value}" has an invalid day`);
  }
  return { year, month, day };
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Days since 1970-01-01 (Hinnant, `days_from_civil`). Exact integer arithmetic,
 * valid for any year the calendar itself is defined on.
 */
export function toEpochDay(value: IsoDate): number {
  const { year, month, day } = parseIsoDate(value);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400; // [0, 399]
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1; // [0, 365]
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverse of `toEpochDay` (Hinnant, `civil_from_days`). */
export function fromEpochDay(epochDay: number): IsoDate {
  if (!Number.isSafeInteger(epochDay)) {
    throw new TypeError(`epochDay must be an integer, got ${String(epochDay)}`);
  }
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097; // [0, 146096]
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153); // [0, 11]
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  const calendarYear = month <= 2 ? year + 1 : year;

  return `${String(calendarYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** `date + days`, as an ISO date. */
export function addDays(value: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(value) + days);
}

/** Number of days in the half-open interval `[from, to)`; never negative. */
export function dayCount(range: DateRange): number {
  const from = toEpochDay(range.from);
  const to = toEpochDay(range.to);
  return Math.max(0, to - from);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  const left = toEpochDay(a);
  const right = toEpochDay(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) <= 0 ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) >= 0 ? a : b;
}

/** Half-open interval on the day index, used internally. */
type DaySpan = { start: number; end: number };

function spanOf(range: DateRange): DaySpan {
  return { start: toEpochDay(range.from), end: toEpochDay(range.to) };
}

function spanLength(span: DaySpan): number {
  return Math.max(0, span.end - span.start);
}

function intersectSpans(a: DaySpan, b: DaySpan): DaySpan {
  return { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) };
}

/**
 * The participant's membership window as a half-open span. `leftAt` is the first
 * day *after* membership, per `[joinedAt, leftAt)` in §4.1.
 */
function membershipSpan(participant: Participant): DaySpan {
  const start = toEpochDay(participant.joinedAt);
  const end = participant.leftAt === null ? Number.POSITIVE_INFINITY : toEpochDay(participant.leftAt);
  if (end < start) {
    throw new RangeError(`participant ${participant.id} left (${participant.leftAt}) before joining (${participant.joinedAt})`);
  }
  return { start, end };
}

/**
 * Merges overlapping/adjacent absence spans so no day is ever subtracted twice.
 *
 * The database forbids overlapping absences for one participant (`EXCLUDE USING
 * gist`, §11) precisely because a doubly-subtracted day would break the invariant.
 * Merging here makes the core safe even if it is ever handed unvalidated data.
 */
function mergeSpans(spans: DaySpan[]): DaySpan[] {
  const usable = spans.filter((span) => span.end > span.start).sort((a, b) => a.start - b.start);
  const merged: DaySpan[] = [];
  for (const span of usable) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * Absence rows are stored with both ends inclusive (§11), so the half-open span
 * runs to `endsOn + 1`.
 */
function absenceSpan(absence: Absence): DaySpan {
  const start = toEpochDay(absence.startsOn);
  const end = toEpochDay(absence.endsOn) + 1;
  if (end <= start) {
    throw new RangeError(`absence ${absence.id} ends (${absence.endsOn}) before it starts (${absence.startsOn})`);
  }
  return { start, end };
}

/**
 * `days(i, a, b)` of §4.1 — the number of days in the half-open interval
 * `[from, to)` on which the participant was a member and not absent.
 *
 * Absences of other participants are ignored, so the caller may pass the whole
 * list. Vacation and sick leave count identically (§4.1).
 */
export function daysPresent(
  participant: Participant,
  absences: readonly Absence[],
  from: IsoDate,
  to: IsoDate,
): number {
  const window = intersectSpans(spanOf({ from, to }), membershipSpan(participant));
  const present = spanLength(window);
  if (present === 0) return 0;

  const ownAbsences = mergeSpans(
    absences.filter((absence) => absence.userId === participant.id).map(absenceSpan),
  );

  let absent = 0;
  for (const span of ownAbsences) {
    absent += spanLength(intersectSpans(span, window));
  }

  return present - absent;
}

/** `true` when the participant is a member on `date` — i.e. `date ∈ [joinedAt, leftAt)`. */
export function isMemberOn(participant: Participant, date: IsoDate): boolean {
  const day = toEpochDay(date);
  const span = membershipSpan(participant);
  return day >= span.start && day < span.end;
}

/** `true` when the membership window overlaps the half-open range at all. */
export function overlapsRange(participant: Participant, range: DateRange): boolean {
  return spanLength(intersectSpans(spanOf(range), membershipSpan(participant))) > 0;
}
