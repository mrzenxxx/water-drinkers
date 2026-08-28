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
    announcements(includeHidden: $includeHidden) {
      id
      title
      isNew
      image { url alt mediaType width height }
    }
  }
`;

const SET_IMAGE = `
  mutation ($id: ID!, $image: AnnouncementImageInput) {
    setAnnouncementImage(id: $id, image: $image) {
      id
      image { url alt mediaType width height }
    }
  }
`;

/** Настоящий PNG 4×2: размеры лежат в заголовке IHDR, больше ничего не нужно. */
const PNG_BASE64 = Buffer.from(
  Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x04,
    0x00, 0x00, 0x00, 0x02,
    0x08, 0x06, 0x00, 0x00, 0x00,
  ]),
).toString('base64');

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


describe('картинка объявления', () => {
  const IMAGE = { base64: PNG_BASE64, mediaType: 'image/png', alt: 'Снимок доски объявлений' };

  it('прикладывается администратором и отдаётся ссылкой, а не байтами', async () => {
    const db = seedOffice();
    const id = await publish(db);

    const data = await runOk(SET_IMAGE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, image: IMAGE },
    });

    expect((data.setAnnouncementImage as { image: unknown }).image).toEqual({
      url: `/api/notices/${id}/image`,
      alt: IMAGE.alt,
      mediaType: 'image/png',
      width: 4,
      height: 2,
    });

    // Байты лежат отдельной таблицей: список объявлений их не касается.
    expect(db.tables.announcementImage.rows).toHaveLength(1);
    expect(db.tables.auditEntry.rows.map((row) => row.action)).toEqual([
      'announcement.create',
      'announcement.image',
    ]);
  });

  it('участнику прикладывать нельзя', async () => {
    const db = seedOffice();
    const id = await publish(db);

    const result = await run(SET_IMAGE, {
      db: db.client,
      userId: 'u-0',
      variables: { id, image: IMAGE },
    });
    expect(errorCode(result)).toBe('FORBIDDEN');
  });

  it('не картинка и картинка без описания отвергаются', async () => {
    const db = seedOffice();
    const id = await publish(db);

    const notAnImage = await run(SET_IMAGE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: {
        id,
        image: { ...IMAGE, base64: Buffer.from('<!doctype html>').toString('base64') },
      },
    });
    expect(errorCode(notAnImage)).toBe('BAD_USER_INPUT');

    const noAlt = await run(SET_IMAGE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, image: { ...IMAGE, alt: '   ' } },
    });
    expect(errorCode(noAlt)).toBe('BAD_USER_INPUT');

    // Ни один отказ ничего за собой не оставил.
    expect(db.tables.announcementImage.rows).toHaveLength(0);
  });

  it('вторая картинка заменяет первую, а не добавляется к ней', async () => {
    const db = seedOffice();
    const id = await publish(db);

    await runOk(SET_IMAGE, { db: db.client, userId: ADMIN_ID, variables: { id, image: IMAGE } });
    await runOk(SET_IMAGE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, image: { ...IMAGE, alt: 'Другая подпись' } },
    });

    expect(db.tables.announcementImage.rows).toHaveLength(1);
    expect(db.tables.announcement.rows[0]?.imageAlt).toBe('Другая подпись');
  });

  it('null убирает картинку вместе с байтами', async () => {
    const db = seedOffice();
    const id = await publish(db);
    await runOk(SET_IMAGE, { db: db.client, userId: ADMIN_ID, variables: { id, image: IMAGE } });

    const data = await runOk(SET_IMAGE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, image: null },
    });

    expect((data.setAnnouncementImage as { image: unknown }).image).toBeNull();
    expect(db.tables.announcementImage.rows).toHaveLength(0);
  });

  it('правка текста картинку не трогает', async () => {
    const db = seedOffice();
    const id = await publish(db);
    await runOk(SET_IMAGE, { db: db.client, userId: ADMIN_ID, variables: { id, image: IMAGE } });

    await runOk(UPDATE, {
      db: db.client,
      userId: ADMIN_ID,
      variables: { id, input: { ...NOTICE, body: 'Текст переписан.' } },
    });

    const data = await runOk(LIST, { db: db.client, userId: 'u-0' });
    expect((data.announcements as { image: { alt: string } | null }[])[0]?.image?.alt).toBe(
      IMAGE.alt,
    );
  });
});
