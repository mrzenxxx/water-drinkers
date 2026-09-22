/**
 * Небольшой офис в подставной базе: администратор и несколько участников.
 * Одинаковая отправная точка для всех интеграционных тестов резолверов.
 */

import { createFakeDb, dateColumn, type FakeDb } from './fake-prisma';

export const ADMIN_ID = 'u-admin';
export const START_DATE = '2026-06-01';
/** Чек, лежащий в подставной базе с самого начала: заказ без него не создать (§6.5). */
export const RECEIPT_ID = 'r-1';

export type Office = FakeDb & {
  /** id участников без администратора, в порядке создания. */
  participantIds: string[];
};

export function seedOffice(participants = 3): Office {
  const db = createFakeDb();

  db.tables.fundSettings.seed([{ id: 1, openingBalance: 0n, startDate: dateColumn(START_DATE) }]);

  db.tables.receipt.seed([
    {
      id: RECEIPT_ID,
      storageKey: `db:${RECEIPT_ID}`,
      mediaType: 'application/pdf',
      byteSize: 2048,
      extraction: null,
    },
  ]);

  db.tables.user.seed([
    {
      id: ADMIN_ID,
      login: 'e.kondobarov',
      email: 'e.kondobarov@sspk.spb.ru',
      firstName: 'Евгений',
      lastName: 'Кондобаров',
      role: 'ADMIN',
      joinedAt: dateColumn(START_DATE),
    },
  ]);

  const participantIds: string[] = [];
  for (let index = 0; index < participants; index += 1) {
    const id = `u-${index}`;
    participantIds.push(id);
    db.tables.user.seed([
      {
        id,
        login: `p${index}`,
        email: `p${index}@sspk.spb.ru`,
        firstName: `Имя${index}`,
        lastName: `Фамилия${index}`,
        role: 'PARTICIPANT',
        joinedAt: dateColumn(START_DATE),
      },
    ]);
  }

  return Object.assign(db, { participantIds });
}
