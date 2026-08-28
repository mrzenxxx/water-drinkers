import { describe, expect, it } from 'vitest';

import { errorCode, run, runOk, testContext } from '../support/graphql';
import { ADMIN_ID, seedOffice } from '../support/office';

/**
 * Объявления (§6.12) через настоящие резолверы поверх подставной базы.
 *
 * Проверяется то, чего чистые тесты `src/lib/view/announcements.ts` не видят:
 * права по ролям, невидимость черновиков для участника и то, что отметка
 * «прочитано» ставится по самой свежей публикации, а не по «сейчас».
 */

const CREATE = `
  mutation ($input: AnnouncementInput!) {
    createAnnouncement(input: $input) {
      id
      title
      pinned
      publishedAt
      isNew
      author { id }
    }
  }
`;

const UPDATE = `
  mutation ($id: ID!, $input: AnnouncementInput!) {
    updateAnnouncement(id: $id, input: $input) { id title publishedAt pinned }
  }
`;

const ARCHIVE = `
  mutation ($id: ID!, $archived: Boolean!) {
    setAnnouncementArchived(id: $id, archived: $archived) { id archivedAt }
  }
`;

const LIST = `
  query ($includeHidden: Boolean) {
    announcements(includeHidden: $includeHidden) { id title isNew }
  }
`;

const UNREAD = `query { unreadAnnouncements }`;
const MARK = `mutation { markAnnouncementsSeen }`;

const NOTICE = { title: 'Как пользоваться кассой', body: 'Взнос — 500 ₽ раз в месяц.' };

async function publish(
  db: ReturnType<typeof seedOffice>,
  input: Record<string, unknown> = NOTICE,
): Promise<string> {
  const data = await runOk(CREATE, { db: db.client, userId: ADMIN_ID, variables: { input } });
  return (data.createAnnouncement as { id: string }).id;
}

describe('создание объявления', () => {
  it('доступно только администратору', async () => {
    const db = seedOffice();

    const anonymous = await run(CREATE, { db: db.client, variables: { input: NOTICE } });
    expect(errorCode(anonymous)).toBe('UNAUTHENTICATED');

    const participant = await run(CREATE, {
      db: db.client,
      userId: 'u-0',
      variables: { input: NOTICE },
    });
    expect(errorCode(participant)).toBe('FORBIDDEN');

    const data = await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...NOTICE, pinned: true } },
    });
    expect(data.createAnnouncement).toMatchObject({
      title: NOTICE.title,
      pinned: true,
      author: { id: ADMIN_ID },
    });
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual(['announcement.create']);
  });

  it('пустой заголовок и пустой текст не принимаются', async () => {
    const db = seedOffice();

    for (const input of [
      { title: '   ', body: 'текст' },
      { title: 'заголовок', body: '\n\n' },
    ]) {
      const result = await run(CREATE, { db: db.client, userId: ADMIN_ID, variables: { input } });
      expect(errorCode(result)).toBe('BAD_USER_INPUT');
    }
  });

  it('черновик сохраняется без даты публикации', async () => {
    const db = seedOffice();
    const data = await runOk(CREATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { input: { ...NOTICE, published: false } },
    });

    expect((data.createAnnouncement as { publishedAt: string | null }).publishedAt).toBeNull();
  });
});

describe('видимость', () => {
  it('участнику видно опубликованное, но не черновик и не архив', async () => {
    const db = seedOffice();
    const live = await publish(db);
    await publish(db, { ...NOTICE, title: 'Черновик', published: false });
    const archived = await publish(db, { ...NOTICE, title: 'Старое' });
    await runOk(ARCHIVE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: archived, archived: true },
    });

    const data = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect((data.announcements as { id: string }[]).map((item) => item.id)).toEqual([live]);
  });

  it('участник не может попросить черновики: это отказ, а не пустой список', async () => {
    const db = seedOffice();
    await publish(db, { ...NOTICE, published: false });

    const result = await run(LIST, {
      db: db.client,
      userId: 'u-0',
      variables: { includeHidden: true },
    });
    expect(errorCode(result)).toBe('FORBIDDEN');

    const forAdmin = await runOk(LIST, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { includeHidden: true },
    });
    expect(forAdmin.announcements).toHaveLength(1);
  });

  it('закреплённое стоит выше свежего', async () => {
    const db = seedOffice();
    await publish(db, { ...NOTICE, title: 'Свежее' });
    await publish(db, { ...NOTICE, title: 'Инструкция', pinned: true });

    const data = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect((data.announcements as { title: string }[]).map((item) => item.title)).toEqual([
      'Инструкция',
      'Свежее',
    ]);
  });
});

describe('правка', () => {
  it('не сдвигает дату публикации', async () => {
    const db = seedOffice();
    const id = await publish(db);

    const before = await runOk(LIST, { db: db.client, userId: ADMIN_ID });
    const published = (
      await runOk(UPDATE, {
        db: db.client,
        userId: ADMIN_ID,
        variables: { id, input: { title: 'Как пользоваться кассой', body: 'Взнос — 600 ₽.' } },
      })
    ).updateAnnouncement as { publishedAt: string };

    // Момент публикации — это когда команда впервые увидела сообщение.
    // Сдвинь его правка опечатки — старая инструкция вспыхнула бы у всех
    // как свежая новость.
    expect(published.publishedAt).toBe(
      (db.tables.announcement.rows[0]?.publishedAt as Date).toISOString(),
    );
    expect(before.announcements).toHaveLength(1);
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'announcement.create',
      'announcement.update',
    ]);
  });

  it('участнику запрещена, а несуществующее объявление даёт NOT_FOUND', async () => {
    const db = seedOffice();
    const id = await publish(db);

    const byParticipant = await run(UPDATE, {
      db: db.client,
      userId: 'u-0',
      variables: { id, input: NOTICE },
    });
    expect(errorCode(byParticipant)).toBe('FORBIDDEN');

    const missing = await run(UPDATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id: '00000000-0000-4000-8000-999999999999', input: NOTICE },
    });
    expect(errorCode(missing)).toBe('NOT_FOUND');
  });

  it('снятие с публикации возвращает объявление в черновики', async () => {
    const db = seedOffice();
    const id = await publish(db);

    await runOk(UPDATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, input: { ...NOTICE, published: false } },
    });

    const data = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect(data.announcements).toEqual([]);
  });
});

describe('архив', () => {
  it('повторное убирание в архив не ошибка и не пишет в журнал дважды', async () => {
    const db = seedOffice();
    const id = await publish(db);

    await runOk(ARCHIVE, { db: db.client, userId: ADMIN_ID, variables: { id, archived: true } });
    await runOk(ARCHIVE, { db: db.client, userId: ADMIN_ID, variables: { id, archived: true } });

    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'announcement.create',
      'announcement.archive',
    ]);
  });

  it('возврат из архива снова показывает объявление участнику', async () => {
    const db = seedOffice();
    const id = await publish(db);

    await runOk(ARCHIVE, { db: db.client, userId: ADMIN_ID, variables: { id, archived: true } });
    await runOk(ARCHIVE, { db: db.client, userId: ADMIN_ID, variables: { id, archived: false } });

    const data = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect(data.announcements).toHaveLength(1);
  });
});

describe('непрочитанное', () => {
  it('считается от последнего захода участника', async () => {
    const db = seedOffice();
    await publish(db);
    await publish(db, { ...NOTICE, title: 'Второе' });

    const before = await runOk(UNREAD, { db: db.client, userId: 'u-0' });
    expect(before.unreadAnnouncements).toBe(2);

    await runOk(MARK, { db: db.client, userId: 'u-0' });

    const after = await runOk(UNREAD, { db: db.client, userId: 'u-0' });
    expect(after.unreadAnnouncements).toBe(0);
  });

  it('отметка ставится по самой свежей публикации, а не по «сейчас»', async () => {
    const db = seedOffice();
    await publish(db);

    const marked = await runOk(MARK, { db: db.client, userId: 'u-0' });
    const latest = db.tables.announcement.rows[0]?.publishedAt as Date;
    expect(marked.markAnnouncementsSeen).toBe(latest.toISOString());

    // Объявление, вышедшее **после** отметки, гаснуть не должно. Момент
    // публикации проставляется вручную и заведомо позже отметки: мутация
    // ставит `new Date()`, и два вызова подряд попадают в одну миллисекунду.
    const next = await publish(db, { ...NOTICE, title: 'Вышло после отметки' });
    const row = db.tables.announcement.rows.find((item) => item.id === next);
    (row as Record<string, unknown>).publishedAt = new Date(latest.getTime() + 60_000);

    const after = await runOk(UNREAD, { db: db.client, userId: 'u-0' });
    expect(after.unreadAnnouncements).toBe(1);
  });

  it('без объявлений отмечать нечего', async () => {
    const db = seedOffice();
    const data = await runOk(MARK, { db: db.client, userId: 'u-0' });
    expect(data.markAnnouncementsSeen).toBeNull();
  });

  it('`isNew` считается для того, кто спрашивает', async () => {
    const db = seedOffice();
    await publish(db);
    await runOk(MARK, { db: db.client, userId: 'u-0' });

    const seen = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect((seen.announcements as { isNew: boolean }[])[0]?.isNew).toBe(false);

    // Тот же список глазами другого участника — тот в раздел не заходил.
    const fresh = await runOk(LIST, {
      db: db.client,
      context: testContext({ db: db.client, userId: 'u-1' }),
    });
    expect((fresh.announcements as { isNew: boolean }[])[0]?.isNew).toBe(true);
  });

  it('счётчик требует входа', async () => {
    const db = seedOffice();
    expect(errorCode(await run(UNREAD, { db: db.client }))).toBe('UNAUTHENTICATED');
    expect(errorCode(await run(MARK, { db: db.client }))).toBe('UNAUTHENTICATED');
  });
});
