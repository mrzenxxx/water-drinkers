import type { ReactNode } from 'react';

import { ActionForm } from '@/components/admin/action-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createAnnouncementAction,
  setAnnouncementArchivedAction,
  setAnnouncementPinnedAction,
  updateAnnouncementAction,
} from '@/lib/actions/announcements';
import { formatDateTime } from '@/lib/format';
import { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from '@/lib/images';
import { MAX_PINNED_ANNOUNCEMENTS, type AnnouncementView } from '@/lib/view/announcements';

/**
 * Формы объявлений в админ-панели (§6.12).
 *
 * Серверные компоненты: сама разметка полей в браузер не едет, клиентской
 * остаётся только обвязка `ActionForm` — она же и во всех прочих формах
 * раздела. Ни `onSubmit`, ни ручного `fetch`, ни флага занятости (React 19).
 *
 * Невыбранный флажок в `FormData` не приходит вовсе, и действие читает именно
 * это: «поля нет» — значит «выключено». Отдельного скрытого поля со значением
 * `false` не нужно, а с ним пришлось бы разбирать два источника одной правды.
 */

/** Подсказка про разметку текста — одна на обе формы, чтобы не разъехалась. */
function BodyHint(): ReactNode {
  return (
    <p className="text-muted-foreground text-xs">
      Пустая строка начинает абзац. Строка, начатая с «-», становится пунктом списка,
      а начатая с «1.» — шагом инструкции. Другой разметки нет: объявление показывается
      текстом, а не разбирается как HTML.
    </p>
  );
}

function Fields({
  idPrefix,
  item,
}: {
  idPrefix: string;
  item?: AnnouncementView;
}): ReactNode {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-title`}>Заголовок</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={200}
          defaultValue={item?.title}
          placeholder="Как пользоваться кассой"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-body`}>Текст</Label>
        <Textarea
          id={`${idPrefix}-body`}
          name="body"
          required
          rows={item === undefined ? 6 : 10}
          defaultValue={item?.body}
          placeholder={'Что произошло и что с этим делать.\n\n- первый пункт\n- второй пункт'}
        />
        <BodyHint />
      </div>

      <ImageFields idPrefix={idPrefix} item={item} />

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-pinned`}>
          <input
            id={`${idPrefix}-pinned`}
            name="pinned"
            type="checkbox"
            defaultChecked={item?.pinned ?? false}
            className="accent-primary size-4"
          />
          Закрепить наверху
        </label>

        <label className="flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-published`}>
          <input
            id={`${idPrefix}-published`}
            name="published"
            type="checkbox"
            defaultChecked={item === undefined ? true : item.publishedAt !== null}
            className="accent-primary size-4"
          />
          Опубликовать
        </label>
      </div>
    </>
  );
}

/**
 * Картинка объявления.
 *
 * Подпись обязательна вместе с файлом: картинка без описания молчит для тех,
 * кто её не видит (§12), и это же правило стоит в базе отдельным `CHECK`.
 * Формат проверяется по сигнатуре файла, а не по расширению, — `accept`
 * здесь лишь подсказка выбирающему, а не защита.
 */
function ImageFields({
  idPrefix,
  item,
}: {
  idPrefix: string;
  item?: AnnouncementView;
}): ReactNode {
  const current = item?.image ?? null;
  const limitMb = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-image`}>Картинка</Label>

      {current !== null && (
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            width={current.width}
            height={current.height}
            className="border-border h-16 w-auto rounded-md border"
          />
          <span className="text-muted-foreground text-xs">
            {current.width}×{current.height}, {current.mediaType}. Новый файл заменит эту картинку.
          </span>
        </div>
      )}

      <Input
        id={`${idPrefix}-image`}
        name="image"
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(',')}
        className="file:text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm"
      />

      <Input
        name="imageAlt"
        maxLength={300}
        defaultValue={current?.alt}
        placeholder="Что на картинке — для тех, кто её не видит"
        aria-label="Описание картинки"
      />

      <p className="text-muted-foreground text-xs">
        До {limitMb} МБ, форматы: PNG, JPEG, GIF, WebP. Описание обязательно — без него
        картинка молчит для читалки экрана. Картинка у объявления одна.
      </p>

      {current !== null && (
        <label className="flex items-center gap-2 text-sm" htmlFor={`${idPrefix}-remove-image`}>
          <input
            id={`${idPrefix}-remove-image`}
            name="removeImage"
            type="checkbox"
            className="accent-primary size-4"
          />
          Убрать картинку
        </label>
      )}
    </div>
  );
}

/** Новое объявление. */
export function AnnouncementComposer(): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое объявление</CardTitle>
        <CardDescription>
          Закреплённое не тонет в списке — так живут инструкции по пользованию системой.
          Закрепить можно не больше {MAX_PINNED_ANNOUNCEMENTS} объявлений.
          Снятая галочка «Опубликовать» сохраняет черновик: участникам он не виден.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={createAnnouncementAction} submitLabel="Сохранить">
          <Fields idPrefix="new-announcement" />
        </ActionForm>
      </CardContent>
    </Card>
  );
}

/**
 * Правка существующего объявления.
 *
 * Правка разрешена — опечатку в инструкции нужно уметь исправить, и правило 4
 * CLAUDE.md о неизменяемости журнала сюда не относится: оно про
 * `fund_transactions`. Каждая правка при этом ложится в журнал аудита §6.7
 * со снимком «до» и «после».
 *
 * Форма правки свёрнута в `<details>`: список из десятка развёрнутых полей
 * читать невозможно, а свернуть его состоянием значило бы завести клиентский
 * компонент там, где хватает разметки.
 */
export function AnnouncementEditor({ item }: { item: AnnouncementView }): ReactNode {
  const archived = item.archivedAt !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <CardTitle>{item.title}</CardTitle>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {item.pinned && <Badge variant="outline">Закреплено</Badge>}
            {item.publishedAt === null && <Badge variant="secondary">Черновик</Badge>}
            {archived && <Badge variant="secondary">В архиве</Badge>}
          </div>
        </div>
        <CardDescription>
          {item.publishedAt === null
            ? `Не опубликовано, изменено ${formatDateTime(item.updatedAt)}`
            : `Опубликовано ${formatDateTime(item.publishedAt)}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <details className="group">
          <summary className="text-primary cursor-pointer text-sm underline underline-offset-4">
            Изменить текст
          </summary>

          <div className="mt-4">
            <ActionForm action={updateAnnouncementAction} submitLabel="Сохранить">
              <input type="hidden" name="id" value={item.id} />
              <Fields idPrefix={`announcement-${item.id}`} item={item} />
            </ActionForm>
          </div>
        </details>

        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          {/*
            Закрепление — отдельной кнопкой, без правки текста. Кнопка не
            гаснет и при полном наборе закреплённых: нажав её, администратор
            получает объяснение, какое из них открепить, а не немую серую кнопку.
          */}
          {!archived && (
            <ActionForm
              action={setAnnouncementPinnedAction}
              submitLabel={item.pinned ? 'Открепить' : 'Закрепить'}
              variant="outline"
              size="sm"
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="pinned" value={item.pinned ? 'false' : 'true'} />
            </ActionForm>
          )}

          {/*
            Архив, а не удаление: сообщение уходит с глаз, но остаётся в истории.
            Удалить строку значило бы стереть и то, на что ссылается журнал аудита.
          */}
          <ActionForm
            action={setAnnouncementArchivedAction}
            submitLabel={archived ? 'Вернуть в список' : 'Убрать в архив'}
            variant="outline"
            size="sm"
          >
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="archived" value={archived ? 'false' : 'true'} />
          </ActionForm>
        </div>
      </CardContent>
    </Card>
  );
}
