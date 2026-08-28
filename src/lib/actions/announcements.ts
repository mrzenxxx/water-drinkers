'use server';

/**
 * Server Actions раздела объявлений (§6.12).
 *
 * Как и во всей админ-панели, действие не ходит по HTTP к собственному
 * `/api/graphql` (CLAUDE.md, §12а), а зовёт **тот же резолвер**: там уже лежат
 * проверка роли, ограничения на длину полей, транзакция и запись в журнал
 * аудита. Второй реализации этих правил в проекте нет — разойдясь, они дали бы
 * приложение, которое через форму разрешает то, что запрещает через GraphQL.
 *
 * Модуль помечен `'use server'`, поэтому экспортировать отсюда можно только
 * асинхронные функции: `ok` и `failed` живут здесь локально, а не приезжают
 * из соседнего файла с той же директивой.
 */

import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';
import { revalidatePath } from 'next/cache';

import type { ActionState } from '@/components/admin/action-state';
import type { GraphQLContext } from '@/graphql/context';
import type {
  MutationCreateAnnouncementArgs,
  MutationSetAnnouncementArchivedArgs,
  MutationSetAnnouncementImageArgs,
  MutationUpdateAnnouncementArgs,
} from '@/graphql/generated/graphql';
import { announcementMutations } from '@/graphql/resolvers/mutation/announcement';
import { ImageError, inspectImage } from '@/lib/images';

import { actionContext } from './runtime';

function ok(message: string): ActionState {
  return { status: 'success', message };
}

function failed(cause: unknown): ActionState {
  // `GraphQLError` и `ImageError` несут формулировку, написанную для человека
  // (§10.3). Всё остальное — настоящая поломка: подробности в лог, наружу
  // нейтрально.
  if (cause instanceof GraphQLError) return { status: 'error', message: cause.message };
  if (cause instanceof ImageError) return { status: 'error', message: cause.message };

  console.error('[waterdrinkers] действие с объявлением не выполнено:', cause);
  return {
    status: 'error',
    message: 'Не удалось выполнить действие. Подробности — в логе сервера.',
  };
}

/** Резолверам объявлений разбор GraphQL-документа не нужен: они его не читают. */
const NO_INFO = {} as GraphQLResolveInfo;

type Call<TArgs> = (
  parent: unknown,
  args: TArgs,
  context: GraphQLContext,
  info: GraphQLResolveInfo,
) => Promise<unknown>;

const call = {
  create: announcementMutations.createAnnouncement as Call<MutationCreateAnnouncementArgs>,
  update: announcementMutations.updateAnnouncement as Call<MutationUpdateAnnouncementArgs>,
  archive: announcementMutations.setAnnouncementArchived as Call<MutationSetAnnouncementArchivedArgs>,
  image: announcementMutations.setAnnouncementImage as Call<MutationSetAnnouncementImageArgs>,
};

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Невыбранный флажок в `FormData` не приходит вовсе — это и есть «выключен». */
function flag(form: FormData, name: string): boolean {
  return form.get(name) !== null;
}

/**
 * Картинка из формы: то, что действительно приложили, или `null`.
 *
 * Пустое поле выбора файла приходит как `File` нулевой длины, а не как
 * отсутствие поля, — иначе форма без картинки считалась бы попыткой её
 * приложить и падала бы на пустом файле.
 */
function pickedFile(form: FormData, name: string): File | null {
  const value = form.get(name);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

type PreparedImage = { base64: string; mediaType: string; alt: string };

/**
 * Файл → аргумент мутации.
 *
 * Формат проверяется **здесь же**, до создания объявления: иначе неудачная
 * картинка оставляла бы за собой уже сохранённую запись без неё. Это не второй
 * рубеж правил, а тот же самый — `inspectImage` один на оба места, и резолвер
 * зовёт его снова уже как последнюю границу перед базой.
 */
async function prepareImage(file: File, alt: string): Promise<PreparedImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes, file.type);

  return {
    base64: Buffer.from(bytes).toString('base64'),
    mediaType: info.mediaType,
    alt,
  };
}

/**
 * Приложить, заменить или убрать картинку — после того, как само объявление
 * сохранено.
 *
 * Отдельным вызовом, а не полем в `AnnouncementInput`: там «поле не прислали»
 * и «поле пустое» пришлось бы различать, чтобы правка текста не сносила
 * картинку молча.
 */
async function applyImage(
  form: FormData,
  id: string,
  context: Awaited<ReturnType<typeof actionContext>>,
): Promise<void> {
  if (flag(form, 'removeImage')) {
    await call.image(undefined, { id, image: null }, context, NO_INFO);
    return;
  }

  const file = pickedFile(form, 'image');
  if (file === null) return;

  const alt = text(form, 'imageAlt');
  await call.image(
    undefined,
    { id, image: await prepareImage(file, alt) },
    context,
    NO_INFO,
  );
}

/**
 * Объявление затрагивает шапку на **каждой** странице приложения: там висит
 * счётчик непрочитанного. Поэтому обновляется весь макет, а не один раздел.
 */
function revalidateEverywhere(): void {
  revalidatePath('/', 'layout');
}

export async function createAnnouncementAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const context = await actionContext();

    // Картинка готовится до создания объявления: непринятый файл не должен
    // оставлять за собой сохранённую запись без него.
    const file = pickedFile(form, 'image');
    const image = file === null ? null : await prepareImage(file, text(form, 'imageAlt'));

    const created = (await call.create(
      undefined,
      {
        input: {
          title: text(form, 'title'),
          body: text(form, 'body'),
          pinned: flag(form, 'pinned'),
          published: flag(form, 'published'),
        },
      },
      context,
      NO_INFO,
    )) as { id: string };

    if (image !== null) {
      await call.image(undefined, { id: created.id, image }, context, NO_INFO);
    }
  } catch (cause) {
    return failed(cause);
  }

  revalidateEverywhere();
  return ok(flag(form, 'published') ? 'Объявление опубликовано.' : 'Черновик сохранён.');
}

export async function updateAnnouncementAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = text(form, 'id');

  try {
    const context = await actionContext();
    await call.update(
      undefined,
      {
        id,
        input: {
          title: text(form, 'title'),
          body: text(form, 'body'),
          pinned: flag(form, 'pinned'),
          published: flag(form, 'published'),
        },
      },
      context,
      NO_INFO,
    );
    await applyImage(form, id, context);
  } catch (cause) {
    return failed(cause);
  }

  revalidateEverywhere();
  return ok('Объявление сохранено.');
}

export async function setAnnouncementArchivedAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const archived = text(form, 'archived') === 'true';

  try {
    const context = await actionContext();
    await call.archive(undefined, { id: text(form, 'id'), archived }, context, NO_INFO);
  } catch (cause) {
    return failed(cause);
  }

  revalidateEverywhere();
  return ok(archived ? 'Объявление убрано в архив.' : 'Объявление возвращено в список.');
}
