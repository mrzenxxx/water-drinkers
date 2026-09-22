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
 *
 * Ссылка «Скачать» у PDF показывается только для файла, который лежит на
 * сервере (адрес начинается с `/api/`), а не для локального `blob:`-адреса
 * (выбранный, но не отправленный файл): маршрут выдачи умеет отдавать чек как
 * вложение (`?download=1`), а `blob:`-адрес это игнорирует и всё равно
 * откроет файл в новой вкладке. Причина, по которой скачивание — не просто
 * удобство: у встроенного просмотрщика PDF стоит `Content-Security-Policy:
 * sandbox` (§8.4), и он местами показывает пустую рамку — скачивание тогда
 * единственный работающий выход.
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
  const isServerFile = src.startsWith('/api/');

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
          <object
            data={src}
            type="application/pdf"
            aria-label={title}
            className="border-border h-[70vh] w-full rounded-md border"
          >
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

        <div className="flex flex-wrap gap-4">
          <a className="text-muted-foreground text-sm underline" href={src} target="_blank" rel="noreferrer">
            Открыть в новой вкладке
          </a>

          {isPdf && isServerFile && (
            <a className="text-muted-foreground text-sm underline" href={`${src}?download=1`}>
              Скачать
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
