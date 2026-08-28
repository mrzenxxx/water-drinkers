import type { Prisma } from '@/generated/prisma/client';
import type { GraphQLContext } from '@/graphql/context';
import { requireAdmin, requireUser } from '@/graphql/context';
import { badInput, notFound, requireText } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { markAnnouncementsSeen, writeAudit } from '@/lib/data';

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
}): Prisma.InputJsonObject {
  return {
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

export const announcementMutations: Pick<
  MutationResolvers<GraphQLContext>,
  'createAnnouncement' | 'updateAnnouncement' | 'setAnnouncementArchived' | 'markAnnouncementsSeen'
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
        data: { archivedAt: archived ? new Date() : null },
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
