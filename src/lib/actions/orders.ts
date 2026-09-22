'use server';

/**
 * Отметить поставку воды (§6.5).
 *
 * Действие не ходит по HTTP к собственному `/api/graphql` и не пишет в Prisma
 * само (ADR-0002): оно зовёт те же резолверы, что обслуживают эндпоинт, —
 * там проверка роли, транзакция, строка в журнале операций и аудит. Второй
 * реализации этих правил в проекте нет, и заводить её нельзя: разойдясь, они
 * дали бы заказ, который есть в таблице, но не в журнале, и инвариант §5
 * сломался бы тихо.
 *
 * Чек загружается **до** создания заказа: `createWaterOrder` требует готовый
 * `receiptFileId`. Если вторая мутация откажет, загруженный чек останется
 * ни к чему не привязанным — он никому не виден (§8.4) и виден в аудите.
 */

import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';
import { revalidatePath } from 'next/cache';

import type { ActionState } from '@/components/admin/action-state';
import { requireAdmin } from '@/graphql/context';
import type { GraphQLContext } from '@/graphql/context';
import type {
  MutationCreateWaterOrderArgs,
  MutationUploadReceiptArgs,
} from '@/graphql/generated/graphql';
import { orderMutations } from '@/graphql/resolvers/mutation/order';
import { receiptMutations } from '@/graphql/resolvers/mutation/receipt';
import { parseRubles } from '@/lib/money';
import { ReceiptFileError, inspectReceiptFile } from '@/lib/receipts/file';

import { actionContext } from './runtime';

/** Резолверам заказа разбор GraphQL-документа не нужен: они его не читают. */
const NO_INFO = {} as GraphQLResolveInfo;

type Call<TArgs> = (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo,
) => Promise<unknown>;

const call = {
  upload: receiptMutations.uploadReceipt as Call<MutationUploadReceiptArgs>,
  create: orderMutations.createWaterOrder as Call<MutationCreateWaterOrderArgs>,
};

function ok(message: string): ActionState {
  return { status: 'success', message };
}

function failed(cause: unknown): ActionState {
  // `GraphQLError`, `ReceiptFileError` и `RangeError` разбора суммы несут
  // формулировку, написанную для человека. Всё остальное — настоящая
  // поломка: подробности в лог, наружу нейтрально.
  if (cause instanceof GraphQLError) return { status: 'error', message: cause.message };
  if (cause instanceof ReceiptFileError) return { status: 'error', message: cause.message };
  if (cause instanceof RangeError) return { status: 'error', message: cause.message };

  console.error('[waterdrinkers] поставку отметить не удалось:', cause);
  return {
    status: 'error',
    message: 'Не удалось отметить поставку. Подробности — в логе сервера.',
  };
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(form: FormData, name: string): string | null {
  const value = text(form, name);
  return value === '' ? null : value;
}

function required(form: FormData, name: string, what: string): string {
  const value = text(form, name);
  if (value === '') throw new RangeError(`Заполните поле «${what}».`);
  return value;
}

/**
 * Пустое поле выбора файла приходит как `File` нулевой длины, а не как
 * отсутствие поля, — иначе форма без чека падала бы на разборе пустых байтов
 * вместо внятного «приложите чек».
 */
function pickedFile(form: FormData, name: string): File | null {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

function bottles(form: FormData): number | null {
  const value = text(form, 'bottlesCount');
  if (value === '') return null;

  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('Количество бутылей — целое положительное число.');
  }
  return count;
}

export async function createWaterOrderAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const context = await actionContext();

    // Роль проверяется первым делом, до чтения и загрузки файла. Адрес
    // серверного действия уходит в разметку и остаётся публичной точкой
    // входа: без этой проверки вошедший участник (не администратор) успевал
    // бы положить в базу файл чека через `uploadReceipt` — она открыта
    // любому вошедшему (§8.4) — и только потом получал бы отказ от
    // `createWaterOrder`, уже после записи. Это не замена проверке в
    // резолвере — та проверка остаётся ровно там, где была; здесь та же
    // самая проверка вызывается раньше, чтобы отказ случился раньше траты.
    await requireAdmin(context);

    const file = pickedFile(form, 'receipt');
    if (file === null) {
      throw new RangeError('Приложите чек: поставка без подтверждения оплаты не отмечается.');
    }

    // Формат проверяется здесь же, до обращения к базе: неподходящий файл
    // не должен доезжать до транзакции. Это не второй рубеж правил, а тот
    // же самый — `inspectReceiptFile` один на оба места, и резолвер зовёт
    // его снова уже как последнюю границу перед базой.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectReceiptFile(bytes, file.type);

    const amount = parseRubles(required(form, 'amount', 'сумма'));
    const orderedAt = required(form, 'orderedAt', 'дата поставки');
    const bottlesCount = bottles(form);

    const receipt = (await call.upload(
      null,
      { file: { base64: Buffer.from(bytes).toString('base64'), mediaType: info.mediaType } },
      context,
      NO_INFO,
    )) as { id: string };

    await call.create(
      null,
      {
        input: {
          amount,
          orderedAt,
          bottlesCount,
          supplier: optionalText(form, 'supplier'),
          note: optionalText(form, 'note'),
          receiptFileId: receipt.id,
        },
      },
      context,
      NO_INFO,
    );
  } catch (cause) {
    return failed(cause);
  }

  // Заказ двигает остаток фонда и балансы: их показывают главная, «Фонд» и
  // шапка на каждой странице — поэтому обновляется весь макет, а не раздел.
  revalidatePath('/', 'layout');
  return ok('Поставка отмечена, чек приложен.');
}
