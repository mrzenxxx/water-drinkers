import type { Prisma } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin, requireUser } from '@/graphql/context';
import { badInput, conflict, notFound, requireText } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { markAnnouncementsSeen, writeAudit } from '@/lib/data';
import { ImageError, inspectImage } from '@/lib/images';
import { MAX_PINNED_ANNOUNCEMENTS } from '@/lib/view/announcements';

/**
 * Объявления администратора (§6.12): инструкции и сообщения всем участникам.
 *
 * Денег эти мутации не касаются вовсе — ни строки в `fund_transactions`,
 * ни пересчёта балансов. Поэтому здесь нет ни `invalidateFundState`, ни
 * транзакции вокруг двух таблиц: транзакция нужна только затем, чтобы запись
 * и её след в журнале аудита появлялись вместе или не появлялись совсем.
 *
 * Правило 4 CLAUDE.md (неизменяемость журнала) сюда не распространяется:
 * оно про `fund_transactions`, а опечатку в инструкции нужно уметь исправить.
 * Взамен каждая правка ложится в `audit_log` со снимком «до» и «после».
 */

/** Верхняя граница полей. Заголовок — строка списка, тело — экран текста. */
const MAX_TITLE = 200;
const MAX_BODY = 20_000;

function checkedTitle(value: string): string {
  const title = requireText(value, 'заголовок');
  if (title.length > MAX_TITLE) {
    throw badInput(`Заголовок длиннее ${MAX_TITLE} символов — это уже текст объявления.`, {
      field: 'title',
    });
  }
  return title;
}

function checkedBody(value: string): string {
  const body = requireText(value, 'текст');
  if (body.length > MAX_BODY) {
    throw badInput(`Текст длиннее ${MAX_BODY} символов не поместится на экран.`, { field: 'body' });
  }
  return body;
}

/** Снимок для журнала аудита: значимые поля, а не строка таблицы целиком. */
function snapshot(row: {
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  imageMediaType: string | null;
  imageAlt: string | null;
}): Prisma.InputJsonObject {
  return {
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    // Байтов в журнале нет — только факт картинки и её подпись: журнал §6.7
    // читают люди, и мегабайт в JSONB им ничего не скажет.
    image: row.imageMediaType === null ? null : { mediaType: row.imageMediaType, alt: row.imageAlt },
  };
}

type Tx = Parameters<Parameters<GraphQLContext['db']['$transaction']>[0]>[0];

/**
 * Есть ли место ещё для одного закреплённого (§6.12).
 *
 * Считаются объявления вне архива, черновики включительно: опубликованный
 * позже черновик не должен молча превышать предел. Проверка идёт внутри той же
 * транзакции, что и запись. В отказе перечислены заголовки закреплённых,
 * чтобы администратор сразу видел, какое из них открепить.
 */
async function ensurePinSlot(tx: Tx, exceptId?: string): Promise<void> {
  const pinned = await tx.announcement.findMany({
    where: {
      pinned: true,
      archivedAt: null,
      ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
    },
    orderBy: { createdAt: 'asc' },
  });
  if (pinned.length < MAX_PINNED_ANNOUNCEMENTS) return;

  const titles = pinned.map((row) => `«${row.title}»`).join(', ');
  throw conflict(
    `Закрепить можно не больше ${MAX_PINNED_ANNOUNCEMENTS} объявлений. ` +
      `Сначала открепите одно из закреплённых: ${titles}.`,
    { field: 'pinned' },
  );
}

/** Верхняя граница подписи к картинке: это описание, а не второй текст. */
const MAX_ALT = 300;

export const announcementMutations: Pick<
  MutationResolvers<GraphQLContext>,
  | 'createAnnouncement'
  | 'updateAnnouncement'
  | 'setAnnouncementArchived'
  | 'setAnnouncementPinned'
  | 'setAnnouncementImage'
  | 'markAnnouncementsSeen'
> = {
  createAnnouncement: async (_parent, { input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const title = checkedTitle(input.title);
    const body = checkedBody(input.body);
    const pinned = input.pinned ?? false;
    // Черновик — осознанный выбор администратора: сохранить недописанное,
    // не показывая его команде.
    const publishedAt = (input.published ?? true) ? new Date() : null;

    return ctx.db.$transaction(async (tx) => {
      if (pinned) await ensurePinSlot(tx);

      const row = await tx.announcement.create({
        data: { title, body, pinned, publishedAt, createdBy: admin.id },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'announcement.create',
        entity: 'announcement',
        entityId: row.id,
        after: snapshot(row),
      });

      return row;
    });
  },

  updateAnnouncement: async (_parent, { id, input }, ctx) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.announcement.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Объявление не найдено.', { id });
    }

    const title = checkedTitle(input.title);
    const body = checkedBody(input.body);
    const pinned = input.pinned ?? false;
    const published = input.published ?? true;

    /**
     * Уже опубликованное не переопубликовывается: `published_at` — момент,
     * когда команда впервые увидела сообщение, и сдвинуть его правкой опечатки
     * значило бы подсветить старую инструкцию как свежую новость у всех сразу.
     */
    const publishedAt = published ? (existing.publishedAt ?? new Date()) : null;

    return ctx.db.$transaction(async (tx) => {
      if (pinned && !existing.pinned) await ensurePinSlot(tx, id);

      const row = await tx.announcement.update({
        where: { id },
        data: { title, body, pinned, publishedAt },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'announcement.update',
        entity: 'announcement',
        entityId: id,
        before: snapshot(existing),
        after: snapshot(row),
      });

      return row;
    });
  },

  /**
   * Архив вместо удаления: сообщение уходит с глаз, но остаётся в истории.
   * Удалить строку значило бы стереть и то, на что ссылается журнал аудита.
   *
   * Уходя в архив, объявление открепляется: иначе возврат из архива поставил
   * бы его закреплённым в обход предела §6.12.
   */
  setAnnouncementArchived: async (_parent, { id, archived }, ctx) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.announcement.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Объявление не найдено.', { id });
    }

    // Повторное нажатие ничего не меняет и ошибкой не является.
    if ((existing.archivedAt !== null) === archived) return existing;

    return ctx.db.$transaction(async (tx) => {
      const row = await tx.announcement.update({
        where: { id },
        data: archived ? { archivedAt: new Date(), pinned: false } : { archivedAt: null },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: archived ? 'announcement.archive' : 'announcement.restore',
        entity: 'announcement',
        entityId: id,
        before: snapshot(existing),
        after: snapshot(row),
      });

      return row;
    });
  },

  /**
   * Закрепить или открепить — отдельно от правки текста, одной кнопкой
   * на карточке. Закреплённых не больше трёх (§6.12).
   */
  setAnnouncementPinned: async (_parent, { id, pinned }, ctx) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.announcement.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Объявление не найдено.', { id });
    }

    // Повторное нажатие ничего не меняет и ошибкой не является.
    if (existing.pinned === pinned) return existing;

    if (pinned && existing.archivedAt !== null) {
      throw badInput('Объявление в архиве. Чтобы закрепить, сначала верните его в список.', {
        field: 'pinned',
      });
    }

    return ctx.db.$transaction(async (tx) => {
      if (pinned) await ensurePinSlot(tx, id);

      const row = await tx.announcement.update({ where: { id }, data: { pinned } });

      await writeAudit(tx, {
        actorId: admin.id,
        action: pinned ? 'announcement.pin' : 'announcement.unpin',
        entity: 'announcement',
        entityId: id,
        before: snapshot(existing),
        after: snapshot(row),
      });

      return row;
    });
  },

  /**
   * Приложить картинку к объявлению или убрать её (`image: null`).
   *
   * Отдельной мутацией, а не полем в `AnnouncementInput`: там «поля нет»
   * и «поле пустое» пришлось бы различать, чтобы правка текста не сносила
   * картинку молча. Здесь намерение сказано вслух самим вызовом.
   *
   * Байты приходят в base64. Своего способа передать файл у GraphQL нет,
   * а заводить ради картинки второй путь записи значило бы развести проверку
   * прав и разбор формата по двум местам. Внутри процесса — а серверное
   * действие зовёт резолвер именно так — лишняя перекодировка стоит
   * миллисекунд и не идёт ни по какой сети.
   *
   * Тип берётся из **сигнатуры файла**, а не из того, чем файл назвался:
   * `mediaType` из формы — такой же ввод, как и всё остальное, и страница
   * HTML, названная `image/png`, выполнилась бы в чужом браузере.
   */
  setAnnouncementImage: async (_parent, { id, image }, ctx) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.announcement.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Объявление не найдено.', { id });
    }

    if (image == null) {
      if (existing.imageMediaType === null) return existing;

      return ctx.db.$transaction(async (tx) => {
        await tx.announcementImage.deleteMany({ where: { announcementId: id } });
        const row = await tx.announcement.update({
          where: { id },
          data: { imageMediaType: null, imageAlt: null, imageWidth: null, imageHeight: null },
        });

        await writeAudit(tx, {
          actorId: admin.id,
          action: 'announcement.image',
          entity: 'announcement',
          entityId: id,
          before: snapshot(existing),
          after: snapshot(row),
        });

        return row;
      });
    }

    const alt = requireText(image.alt, 'описание картинки');
    if (alt.length > MAX_ALT) {
      throw badInput(`Описание картинки длиннее ${MAX_ALT} символов — это уже текст.`, {
        field: 'alt',
      });
    }

    let bytes: Uint8Array<ArrayBuffer>;
    try {
      // Байты перекладываются в собственный `Uint8Array`, а не отдаются как
      // `Buffer`: у того тип буфера шире (`ArrayBufferLike`), и колонка
      // `Bytes` его не принимает. Содержимое при этом ровно то же.
      const decoded = Buffer.from(image.base64, 'base64');
      bytes = new Uint8Array(decoded.byteLength);
      bytes.set(decoded);
    } catch {
      throw badInput('Файл картинки не удалось прочитать.', { field: 'image' });
    }

    let info;
    try {
      info = inspectImage(bytes, image.mediaType);
    } catch (error) {
      // `ImageError` несёт формулировку, написанную для человека; всё
      // остальное — настоящая поломка, и прятать её под «неверный ввод» нельзя.
      if (error instanceof ImageError) throw badInput(error.message, { field: 'image' });
      throw error;
    }

    return ctx.db.$transaction(async (tx) => {
      // Картинка у объявления одна, поэтому не «добавить», а «заменить».
      await tx.announcementImage.deleteMany({ where: { announcementId: id } });
      await tx.announcementImage.create({ data: { announcementId: id, bytes } });

      const row = await tx.announcement.update({
        where: { id },
        data: {
          imageMediaType: info.mediaType,
          imageAlt: alt,
          imageWidth: info.width,
          imageHeight: info.height,
        },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        action: 'announcement.image',
        entity: 'announcement',
        entityId: id,
        before: snapshot(existing),
        after: snapshot(row),
      });

      return row;
    });
  },

  /**
   * Отметка «раздел просмотрен».
   *
   * В журнал аудита не пишется: это не действие над данными фонда, а состояние
   * чтения одного человека, и §6.7 обещает журнал операций, а не слежку за тем,
   * кто когда открывал экран.
   *
   * Сама отметка живёт в слое данных: её ставит и эта мутация, и отрисовка
   * страницы `/notices`. Двух реализаций у неё быть не должно — разойдясь,
   * они дали бы разное число непрочитанного в шапке и в разделе.
   */
  markAnnouncementsSeen: async (_parent, _args, ctx) => {
    const user = await requireUser(ctx);
    const seenAt = await markAnnouncementsSeen(ctx.db, user.id);
    return seenAt === null ? null : seenAt.toISOString();
  },
};
