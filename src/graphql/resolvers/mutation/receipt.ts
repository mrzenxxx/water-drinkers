import { randomUUID } from 'node:crypto';

import type { GraphQLContext } from '@/graphql/context';
import { requireUser } from '@/graphql/context';
import { badInput } from '@/graphql/errors';
import type { MutationResolvers } from '@/graphql/generated/graphql';
import { writeAudit } from '@/lib/data';
import { MAX_RECEIPT_BYTES, ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

/**
 * Загрузка файла чека (§8.4).
 *
 * Доступна любому вошедшему: чек заказа прикладывает администратор (§6.5),
 * чек взноса — сам участник (§6.2). Правá на **запись**, к которой чек
 * прикрепится, проверяет та мутация, а не эта: сам по себе загруженный файл
 * ни к чему не привязан и никому не виден (правило видимости в §8.4).
 *
 * Метаданные и байты пишутся одной транзакцией: чек без файла означал бы
 * ссылку в заказе, ведущую в пустоту.
 */
export const receiptMutations: Pick<MutationResolvers<GraphQLContext>, 'uploadReceipt'> = {
  uploadReceipt: async (_parent, { file }, ctx) => {
    const user = await requireUser(ctx);

    // База64 раздувает данные на треть. Предел проверяется до декодирования:
    // разворачивать в память заведомо слишком большую строку незачем.
    if (file.base64.length > Math.ceil((MAX_RECEIPT_BYTES * 4) / 3) + 1024) {
      throw badInput(
        `Файл больше ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Уменьшите его и попробуйте снова.`,
        { field: 'file' },
      );
    }

    const bytes = Buffer.from(file.base64, 'base64');

    let info;
    try {
      info = inspectReceiptFile(new Uint8Array(bytes), file.mediaType);
    } catch (cause) {
      if (cause instanceof ReceiptFileError) {
        throw badInput(cause.message, { field: 'file' });
      }
      throw cause;
    }

    // Идентификатор нужен заранее: `storageKey` в §8.4 равен `db:<receipt_id>`,
    // а строка одна и с правильным значением сразу — вместо `create` пустышкой
    // и следующего `update` только ради него.
    const id = randomUUID();

    return ctx.db.$transaction(async (tx) => {
      const row = await tx.receipt.create({
        data: {
          id,
          storageKey: `db:${id}`,
          mediaType: info.mediaType,
          byteSize: info.byteSize,
        },
      });

      await tx.receiptFile.create({ data: { receiptId: row.id, bytes } });

      await writeAudit(tx, {
        actorId: user.id,
        action: 'receipt.upload',
        entity: 'receipt',
        entityId: row.id,
        after: { mediaType: info.mediaType, byteSize: info.byteSize },
      });

      return row;
    });
  },
};
