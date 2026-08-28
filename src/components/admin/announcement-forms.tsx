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
  updateAnnouncementAction,
} from '@/lib/actions/announcements';
import { formatDateTime } from '@/lib/format';
import type { AnnouncementView } from '@/lib/view/announcements';

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

/** Новое объявление. */
export function AnnouncementComposer(): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое объявление</CardTitle>
        <CardDescription>
          Закреплённое не тонет в списке — так живут инструкции по пользованию системой.
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
      </CardContent>
    </Card>
  );
}
