import { describe, expect, it } from 'vitest';

import { toBigIntKopecks, toKopecks } from '@/lib/data/money';
import {
  DEFAULT_FUND_SETTINGS,
  toAbsence,
  toContribution,
  toFundSettings,
  toFundTransaction,
  toParticipant,
  toWaterOrder,
} from '@/lib/data/mappers';
import { dateColumn } from '../support/fake-prisma';

describe('BigInt → копейки', () => {
  it('переводит обычные суммы', () => {
    expect(toKopecks(0n)).toBe(0);
    expect(toKopecks(50_000n)).toBe(50_000);
    expect(toKopecks(-300_000n)).toBe(-300_000);
  });

  it('бросает вместо тихой потери точности', () => {
    // 2^53 копеек — 90 триллионов рублей. Такое число пришло не из кассы,
    // и Number() округлил бы его молча.
    const beyondSafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(() => toKopecks(beyondSafe)).toThrow(RangeError);
    expect(() => toKopecks(-beyondSafe)).toThrow(RangeError);
  });

  it('переводит обратно и отвергает дроби', () => {
    expect(toBigIntKopecks(12_345)).toBe(12_345n);
    expect(() => toBigIntKopecks(12.5)).toThrow(TypeError);
  });
});

describe('строки таблиц → типы ядра', () => {
  it('настройки фонда, включая пустую базу', () => {
    expect(toFundSettings(null)).toEqual(DEFAULT_FUND_SETTINGS);

    expect(
      toFundSettings({
        id: 1,
        openingBalance: 100_000n,
        startDate: dateColumn('2026-06-01'),
        defaultContribution: 50_000n,
      }),
    ).toEqual({ openingBalance: 100_000, startDate: '2026-06-01', defaultContribution: 50_000 });
  });

  it('участник с датами членства', () => {
    expect(
      toParticipant({
        id: 'u1',
        login: 'i.petrov',
        email: 'i.petrov@sspk.spb.ru',
        firstName: 'Иван',
        middleName: null,
        lastName: 'Петров',
        passwordHash: null,
        magicLinkHash: null,
        magicLinkExpiresAt: null,
        departmentId: null,
        restriction: 'NONE',
        sessionsValidAfter: null,
        failedLogins: 0,
        lockedUntil: null,
        role: 'PARTICIPANT',
        joinedAt: dateColumn('2026-06-01'),
        leftAt: dateColumn('2026-10-01'),
        openingBalance: 12_500n,
        createdAt: new Date('2026-06-01T09:00:00.000Z'),
        announcementsSeenAt: null,
      }),
    ).toEqual({ id: 'u1', joinedAt: '2026-06-01', leftAt: '2026-10-01', openingBalance: 12_500 });
  });

  it('отсутствие, заказ и взнос', () => {
    expect(
      toAbsence({
        id: 'a1',
        userId: 'u1',
        type: 'SICK_LEAVE',
        startsOn: dateColumn('2026-06-10'),
        endsOn: dateColumn('2026-06-14'),
        note: null,
        enteredByAdmin: false,
      }),
    ).toEqual({ id: 'a1', userId: 'u1', type: 'SICK_LEAVE', startsOn: '2026-06-10', endsOn: '2026-06-14' });

    expect(
      toWaterOrder({
        id: 'o1',
        amount: 300_000n,
        orderedAt: dateColumn('2026-06-05'),
        bottlesCount: 10,
        supplier: null,
        note: null,
        receiptId: null,
        createdBy: 'u1',
        historical: false,
        createdAt: new Date('2026-06-05T09:00:00.000Z'),
      }),
    ).toEqual({ id: 'o1', amount: 300_000, orderedAt: '2026-06-05', historical: false });

    expect(
      toContribution({
        id: 'c1',
        userId: 'u1',
        amount: 50_000n,
        paidAt: dateColumn('2026-06-02'),
        status: 'CONFIRMED',
        receiptId: null,
        submittedAt: new Date('2026-06-02T09:00:00.000Z'),
        reviewedBy: 'u0',
        reviewedAt: new Date('2026-06-03T09:00:00.000Z'),
        reviewComment: null,
        historical: false,
        enteredByAdmin: false,
      }),
    ).toEqual({
      id: 'c1',
      userId: 'u1',
      amount: 50_000,
      paidAt: '2026-06-02',
      status: 'CONFIRMED',
      historical: false,
    });
  });

  it('не пропускает неизвестные значения перечислений', () => {
    const row = {
      id: 'a1',
      userId: 'u1',
      type: 'REMOTE_WORK',
      startsOn: dateColumn('2026-06-10'),
      endsOn: dateColumn('2026-06-14'),
      note: null,
      enteredByAdmin: false,
    };
    // Удалёнка в расчёте не учитывается (§4.1) — такой строки в базе быть
    // не должно, и подставлять вместо неё отпуск нельзя.
    expect(() => toAbsence(row)).toThrow(RangeError);
  });

  it('в ядро отдаёт только ручные операции журнала', () => {
    const base = {
      id: 't1',
      amount: -50_000n,
      userId: 'u1',
      refId: null,
      comment: 'выплата остатка',
      createdBy: 'u0',
      createdAt: new Date('2026-06-20T09:00:00.000Z'),
    };

    expect(toFundTransaction({ ...base, type: 'SETTLEMENT' })).toMatchObject({
      id: 't1',
      type: 'SETTLEMENT',
      amount: -50_000,
      userId: 'u1',
    });

    // CONTRIBUTION и ORDER ядро выводит из своих таблиц; передать их ещё и
    // журналом — значит посчитать дважды.
    expect(() => toFundTransaction({ ...base, type: 'CONTRIBUTION' })).toThrow(RangeError);
    expect(() => toFundTransaction({ ...base, type: 'ORDER' })).toThrow(RangeError);
    expect(() => toFundTransaction({ ...base, type: 'OPENING' })).toThrow(RangeError);
  });
});
