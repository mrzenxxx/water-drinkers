import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayCount,
  daysPresent,
  fromEpochDay,
  isMemberOn,
  overlapsRange,
  parseIsoDate,
  toEpochDay,
} from '@/lib/calc/dates';
import type { Absence, Participant } from '@/lib/calc/types';

function participant(over: Partial<Participant> = {}): Participant {
  return { id: 'u1', joinedAt: '2026-01-01', leftAt: null, openingBalance: 0, ...over };
}

function absence(over: Partial<Absence> & Pick<Absence, 'startsOn' | 'endsOn'>): Absence {
  return { id: 'a1', userId: 'u1', type: 'VACATION', ...over };
}

describe('dates — calendar arithmetic', () => {
  it('maps ISO dates to day indices and back', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(toEpochDay('2026-06-05')).toBe(toEpochDay('2026-06-04') + 1);
    expect(fromEpochDay(0)).toBe('1970-01-01');

    for (let day = -3000; day <= 25_000; day += 37) {
      expect(toEpochDay(fromEpochDay(day))).toBe(day);
    }
  });

  it('handles leap years and month ends', () => {
    expect(dayCount({ from: '2024-02-01', to: '2024-03-01' })).toBe(29);
    expect(dayCount({ from: '2026-02-01', to: '2026-03-01' })).toBe(28);
    expect(dayCount({ from: '2100-02-01', to: '2100-03-01' })).toBe(28);
    expect(dayCount({ from: '2000-02-01', to: '2000-03-01' })).toBe(29);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejects impossible dates', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow();
    expect(() => parseIsoDate('2026-13-01')).toThrow();
    expect(() => parseIsoDate('2026-1-1')).toThrow();
    expect(() => parseIsoDate('05.06.2026')).toThrow();
  });

  it('counts half-open intervals, never negative', () => {
    expect(dayCount({ from: '2026-06-05', to: '2026-07-05' })).toBe(30);
    expect(dayCount({ from: '2026-06-05', to: '2026-06-05' })).toBe(0);
    expect(dayCount({ from: '2026-07-05', to: '2026-06-05' })).toBe(0);
  });
});

describe('daysPresent (§4.1)', () => {
  it('counts every day of the interval when the participant is always present', () => {
    expect(daysPresent(participant(), [], '2026-06-05', '2026-07-05')).toBe(30);
  });

  it('excludes days outside the membership window [joinedAt, leftAt)', () => {
    const joinedMidPeriod = participant({ joinedAt: '2026-06-20' });
    expect(daysPresent(joinedMidPeriod, [], '2026-06-05', '2026-07-05')).toBe(15);

    // leftAt is the first day *after* membership.
    const left = participant({ leftAt: '2026-06-20' });
    expect(daysPresent(left, [], '2026-06-05', '2026-07-05')).toBe(15);

    const joinedAfter = participant({ joinedAt: '2026-08-01' });
    expect(daysPresent(joinedAfter, [], '2026-06-05', '2026-07-05')).toBe(0);
  });

  it('subtracts absences, both ends inclusive', () => {
    const single = daysPresent(
      participant(),
      [absence({ startsOn: '2026-06-10', endsOn: '2026-06-10' })],
      '2026-06-05',
      '2026-07-05',
    );
    expect(single).toBe(29);

    const fifteen = daysPresent(
      participant(),
      [absence({ startsOn: '2026-06-10', endsOn: '2026-06-24' })],
      '2026-06-05',
      '2026-07-05',
    );
    expect(fifteen).toBe(15);
  });

  it('treats sick leave exactly like vacation', () => {
    const vacation = daysPresent(
      participant(),
      [absence({ startsOn: '2026-06-10', endsOn: '2026-06-14', type: 'VACATION' })],
      '2026-06-05',
      '2026-07-05',
    );
    const sick = daysPresent(
      participant(),
      [absence({ startsOn: '2026-06-10', endsOn: '2026-06-14', type: 'SICK_LEAVE' })],
      '2026-06-05',
      '2026-07-05',
    );
    expect(vacation).toBe(sick);
    expect(vacation).toBe(25);
  });

  it('ignores other participants’ absences', () => {
    const days = daysPresent(
      participant({ id: 'u1' }),
      [absence({ userId: 'u2', startsOn: '2026-06-01', endsOn: '2026-07-01' })],
      '2026-06-05',
      '2026-07-05',
    );
    expect(days).toBe(30);
  });

  it('clips absences to the interval', () => {
    const days = daysPresent(
      participant(),
      [absence({ startsOn: '2026-01-01', endsOn: '2026-12-31' })],
      '2026-06-05',
      '2026-07-05',
    );
    expect(days).toBe(0);
  });

  it('never double-counts an overlapping pair of absences', () => {
    const days = daysPresent(
      participant(),
      [
        absence({ id: 'a1', startsOn: '2026-06-10', endsOn: '2026-06-20' }),
        absence({ id: 'a2', startsOn: '2026-06-15', endsOn: '2026-06-25', type: 'SICK_LEAVE' }),
      ],
      '2026-06-05',
      '2026-07-05',
    );
    // 2026-06-10 .. 2026-06-25 inclusive = 16 days out of 30.
    expect(days).toBe(14);
  });

  it('subtracts only the part of an absence inside the membership window', () => {
    const days = daysPresent(
      participant({ joinedAt: '2026-06-15' }),
      [absence({ startsOn: '2026-06-01', endsOn: '2026-06-19' })],
      '2026-06-05',
      '2026-07-05',
    );
    // Member 15.06–04.07 = 20 days, absent 15.06–19.06 = 5 → 15.
    expect(days).toBe(15);
  });
});

describe('membership helpers', () => {
  it('isMemberOn respects the half-open window', () => {
    const p = participant({ joinedAt: '2026-06-01', leftAt: '2026-06-10' });
    expect(isMemberOn(p, '2026-05-31')).toBe(false);
    expect(isMemberOn(p, '2026-06-01')).toBe(true);
    expect(isMemberOn(p, '2026-06-09')).toBe(true);
    expect(isMemberOn(p, '2026-06-10')).toBe(false);
  });

  it('overlapsRange detects any intersection', () => {
    const p = participant({ joinedAt: '2026-06-01', leftAt: '2026-06-10' });
    expect(overlapsRange(p, { from: '2026-06-09', to: '2026-06-20' })).toBe(true);
    expect(overlapsRange(p, { from: '2026-06-10', to: '2026-06-20' })).toBe(false);
    expect(overlapsRange(p, { from: '2026-06-05', to: '2026-06-05' })).toBe(false);
  });
});
