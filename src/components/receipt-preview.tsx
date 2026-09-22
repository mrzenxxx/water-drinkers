'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Предпросмотр чека (§6.5).
 *
 * Один диалог на два случая: файл, уже лежащий в базе (`/api/receipts/:id`),
 * и файл, только что выбранный в форме (`blob:`-адрес). Отличается лишь
 * источник, поэтому компонент один.
 *
 * PDF показывается встроенным просмотрщиком браузера. На телефонах его нет
 * вовсе — там виден запасной текст со ссылкой, и это норма мобильных
 * браузеров, а не ошибка. Ссылка «открыть в новой вкладке» стоит в диалоге
 * всегда: она работает там, где встроенный просмотрщик не работает.
 */
export function ReceiptPreview({
  src,
  mediaType,
  title,
  label,
  description,
}: {
  src: string;
  mediaType: string;
  /** Заголовок диалога, он же описание картинки для чтения с экрана (§12). */
  title: string;
  label: string;
  description?: string;
}): ReactNode {
  const isPdf = mediaType === 'application/pdf';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? (isPdf ? 'PDF-квитанция.' : 'Снимок экрана или фотография чека.')}
          </DialogDescription>
        </DialogHeader>

        {isPdf ? (
          <object data={src} type="application/pdf" className="border-border h-[70vh] w-full rounded-md border">
            <p className="p-4 text-sm">
              Браузер не показывает PDF прямо здесь.{' '}
              <a className="underline" href={src} target="_blank" rel="noreferrer">
                Откройте чек в новой вкладке
              </a>
              .
            </p>
          </object>
        ) : (
          // Обычный `<img>`, а не `next/image`: оптимизатор ходил бы за файлом
          // отдельным запросом без cookie и получил бы 404, а `blob:`-адрес
          // ему недоступен вовсе.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} className="max-h-[70vh] w-full rounded-md object-contain" />
        )}

        <a className="text-muted-foreground text-sm underline" href={src} target="_blank" rel="noreferrer">
          Открыть в новой вкладке
        </a>
      </DialogContent>
    </Dialog>
  );
}
