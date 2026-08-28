import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import { notFound } from '@/graphql/errors';
import type { AnnouncementResolvers } from '@/graphql/generated/graphql';
import { toIsoDateTime, toIsoDateTimeOrNull } from '@/lib/data';

/**
 * Поля `Announcement`, которых нет в строке таблицы (§6.12).
 *
 * Автор идёт через лоадер: список из десятка объявлений одного и того же
 * администратора без него дал бы десять походов в базу за одной строкой.
 */
export const Announcement: AnnouncementResolvers<GraphQLContext> = {
  publishedAt: (parent) => toIsoDateTimeOrNull(parent.publishedAt),
  archivedAt: (parent) => toIsoDateTimeOrNull(parent.archivedAt),
  updatedAt: (parent) => toIsoDateTime(parent.updatedAt),

  author: async (parent, _args, ctx) => {
    const author = await ctx.loaders.userById.load(parent.createdBy);
    if (author === null) {
      // Участников из базы не удаляют, только помечают вышедшими (§6.7),
      // так что сюда можно попасть лишь при гонке с прямой правкой таблицы.
      throw notFound(`Автор объявления ${parent.id} не найден.`, { userId: parent.createdBy });
    }
    return author;
  },

  /**
   * Новизна считается от момента последнего захода **спрашивающего**, а не
   * от «сегодня»: для того, кто вчера всё прочитал, недельной давности
   * объявление старо, а для вернувшегося из отпуска — ново.
   *
   * Черновик и архив новыми не бывают: участник их вообще не видит.
   */
  isNew: async (parent, _args, ctx) => {
    if (parent.publishedAt === null || parent.archivedAt !== null) return false;

    const user = await requireUser(ctx);
    if (user.announcementsSeenAt === null) return true;

    return parent.publishedAt.getTime() > user.announcementsSeenAt.getTime();
  },
};
