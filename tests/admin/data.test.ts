import { describe, expect, it } from 'vitest';

import { formatKopecks } from '@/lib/money';

import {
  compareWithReceipt,
  concernsParticipant,
  loadAuditLog,
  loadParticipants,
  loadQueue,
  needsAttention,
  participantName,
  sortQueue,
  subjectOf,
  summarize,
  type QueueItem,
} from '@/lib/data/admin';
import { dateColumn } from '../support/fake-prisma';
import { ADMIN_ID, seedOffice, START_DATE } from '../support/office';

/**
 * Разбор данных админ-панели (§6.7).
 *
 * Всё, что видно на экранах, собирается этими функциями: порядок очереди,
 * сравнение с чеком и расшифровка журнала. Проверяются они без базы — ровно за
 * этим они и вынесены из компонентов.
 */

function item(patch: Partial<QueueItem>): QueueItem {
  return {
    id: 'c1',
    userId: 'u-0',
    userName: 'Иванов Иван',
    amount: 50_000,
    paidAt: '2026-06-10',
    submittedAt: '2026-06-10T09:00:00.000Z',
    enteredByAdmin: false,
    receiptUrl: null,
    extraction: null,
    mismatch: { amount: false, paidAt: false, lowConfidence: false },
    needsAttention: false,
    ...patch,
  };
}

describe('очередь подтверждений', () => {
  it('сомнительные — сверху, дальше по старшинству', () => {
    const rows = [
      item({ id: 'c1', submittedAt: '2026-06-01T09:00:00.000Z' }),
      item({ id: 'c2', submittedAt: '2026-06-03T09:00:00.000Z', needsAttention: true }),
      item({ id: 'c3', submittedAt: '2026-06-02T09:00:00.000Z' }),
      item({ id: 'c4', submittedAt: '2026-06-01T09:00:00.000Z', needsAttention: true }),
    ];

    expect(sortQueue(rows).map((row) => row.id)).toEqual(['c4', 'c2', 'c1', 'c3']);
  });

  it('без чека расхождений нет: сравнивать не с чем', () => {
    const mismatch = compareWithReceipt({ amount: 50_000, paidAt: '2026-06-10' }, null);
    expect(mismatch).toEqual({ amount: false, paidAt: false, lowConfidence: false });
    expect(needsAttention(mismatch)).toBe(false);
  });

  it('расхождение с чеком и низкая уверенность помечаются по отдельности', () => {
    const mismatch = compareWithReceipt(
      { amount: 50_000, paidAt: '2026-06-10' },
      {
        paidAt: '2026-06-09',
        amountKopecks: 60_000,
        payerHint: null,
        confidence: 'LOW' as never,
        notes: '',
        provider: 'test',
      },
    );

    expect(mismatch).toEqual({ amount: true, paidAt: true, lowConfidence: true });
    expect(needsAttention(mismatch)).toBe(true);
  });
});

describe('журнал аудита', () => {
  it('участник находится и как действующее лицо, и как предмет действия', () => {
    const byActor = { actorId: 'u-0', entity: 'absence', entityId: 'a1', before: null, after: null };
    const bySubject = {
      actorId: ADMIN_ID,
      entity: 'contribution',
      entityId: 'c1',
      before: null,
      after: { userId: 'u-0', amount: 50_000 },
    };
    const byEntity = { actorId: ADMIN_ID, entity: 'user', entityId: 'u-0', before: null, after: null };
    const other = { actorId: ADMIN_ID, entity: 'contribution', entityId: 'c2', before: null, after: { userId: 'u-1' } };

    for (const entry of [byActor, bySubject, byEntity]) {
      expect(concernsParticipant(entry, 'u-0')).toBe(true);
    }
    expect(concernsParticipant(other, 'u-0')).toBe(false);
    expect(subjectOf(byEntity)).toBe('u-0');
    expect(subjectOf(bySubject)).toBe('u-0');
  });

  it('расшифровка читается людьми, а не машиной', () => {
    expect(summarize({ status: 'PENDING' }, { status: 'CONFIRMED' })).toBe(
      'статус: на рассмотрении → подтверждён',
    );
    // Сумма форматируется тем же `formatKopecks`, что и везде: неразрывный
    // пробел перед ₽ здесь не случайность, и подменять его в тесте нельзя.
    expect(summarize(null, { amount: -50_000, comment: 'лишний взнос' })).toBe(
      `сумма: ${formatKopecks(-50_000)}, комментарий: лишний взнос`,
    );
    expect(summarize({ leftAt: '2026-06-20' }, { leftAt: null })).toBe('вышел: 2026-06-20 → —');
    expect(summarize(null, null)).toBe('');
  });
});

describe('участники', () => {
  it('без имени человека зовут его логином (§6.7)', () => {
    expect(participantName({ firstName: 'Иван', lastName: 'Иванов', login: 'i.ivanov' })).toBe('Иванов Иван');
    expect(participantName({ firstName: null, lastName: null, login: 'i.ivanov' })).toBe('i.ivanov');
  });
});

describe('чтение из базы', () => {
  it('состав отдаётся с балансами из той же точки пересчёта', async () => {
    const db = seedOffice();
    db.tables.contribution.seed([
      { userId: 'u-0', amount: 50_000n, paidAt: dateColumn('2026-06-10'), status: 'CONFIRMED' },
    ]);

    const rows = await loadParticipants(db.client);
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.id === 'u-0')).toMatchObject({
      balance: 50_000,
      owes: false,
      isActive: true,
      role: 'PARTICIPANT',
      joinedAt: START_DATE,
    });
    expect(rows.find((row) => row.id === ADMIN_ID)).toMatchObject({ role: 'ADMIN', balance: 0 });
  });

  it('в очередь попадают только PENDING', async () => {
    const db = seedOffice();
    db.tables.contribution.seed([
      { id: 'c-pending', userId: 'u-0', amount: 50_000n, paidAt: dateColumn('2026-06-10'), status: 'PENDING' },
      { id: 'c-done', userId: 'u-1', amount: 50_000n, paidAt: dateColumn('2026-06-10'), status: 'CONFIRMED' },
    ]);

    const queue = await loadQueue(db.client);
    expect(queue.map((row) => row.id)).toEqual(['c-pending']);
    expect(queue[0]).toMatchObject({ userName: 'Фамилия0 Имя0', receiptUrl: null, extraction: null });
  });

  it('журнал фильтруется по действию и по участнику', async () => {
    const db = seedOffice();
    db.tables.auditEntry.seed([
      { actorId: ADMIN_ID, action: 'participant.add', entity: 'user', entityId: 'u-0' },
      { actorId: 'u-1', action: 'contribution.submit', entity: 'contribution', entityId: 'c1', after: { userId: 'u-1' } },
      { actorId: ADMIN_ID, action: 'fund.adjust', entity: 'fund_transaction', entityId: 't1', after: { amount: 100 } },
    ]);

    const all = await loadAuditLog(db.client);
    expect(all).toHaveLength(3);
    expect(all[0]?.actionLabel).toBe('Корректировка');

    const byAction = await loadAuditLog(db.client, { action: 'participant.add' });
    expect(byAction).toHaveLength(1);
    expect(byAction[0]).toMatchObject({ subjectId: 'u-0', subjectName: 'Фамилия0 Имя0' });

    const byUser = await loadAuditLog(db.client, { userId: 'u-1' });
    expect(byUser).toHaveLength(1);
    expect(byUser[0]?.action).toBe('contribution.submit');
  });
});
