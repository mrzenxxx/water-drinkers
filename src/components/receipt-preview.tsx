'use client';

import { Download, ExternalLink, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';

import { badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Предпросмотр чека (§6.5).
 *
 * Один диалог на два случая: файл, уже лежащий в базе (`/api/receipts/:id`),
 * и файл, только что выбранный в форме (`blob:`-адрес). Отличается лишь
 * источник, поэтому компонент один.
 *
 * PDF показывается встроенным просмотрщиком браузера. На телефонах его нет
 * вовсе — там виден запасной текст со ссылкой, и это норма мобильных
 * браузеров, а не ошибка. Кнопка «Открыть оригинал» стоит в диалоге всегда:
 * она работает там, где встроенный просмотрщик не работает.
 *
 * Над картинкой — только заголовок. Строка «снимок экрана или фотография
 * чека» не сообщала ничего, чего не видно в самой картинке под ней, а
 * `aria-describedby={undefined}` говорит диалогу, что описания у него нет
 * намеренно, и снимает предупреждение о доступности.
 *
 * Открывашек две, и обе ведут в один и тот же диалог. `button` — обычная
 * кнопка раздела «Заказы». `badge` — бейджик в ленте главной, ростом со
 * соседние бейджики статуса, но вывернутый наизнанку: тёмный с светлым
 * текстом на светлой теме и наоборот на тёмной. Соседи стеклянные и только
 * называют состояние; этот сплошной и нажимается, и разница должна быть
 * видна до нажатия, а не после.
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
  variant = 'button',
}: {
  src: string;
  mediaType: string;
  /** Заголовок диалога, он же описание картинки для чтения с экрана (§12). */
  title: string;
  label: string;
  description?: string;
  /** Чем открывается диалог: кнопкой раздела или бейджиком ленты. */
  variant?: 'button' | 'badge';
}): ReactNode {
  const isPdf = mediaType === 'application/pdf';
  const isServerFile = src.startsWith('/api/');

  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === 'badge' ? (
          <button
            type="button"
            className={cn(
              badgeVariants({ variant: 'ghost' }),
              'badge-tap press bg-foreground text-background focus-visible:ring-ring cursor-pointer transition-[opacity,box-shadow] duration-200 hover:opacity-85 focus-visible:ring-2 focus-visible:outline-none',
            )}
          >
            <ReceiptText aria-hidden />
            {label}
          </button>
        ) : (
          <Button type="button" variant="outline" size="sm">
            {label}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && <DialogDescription>{description}</DialogDescription>}
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

        {/*
          Скачивание есть только у файла, лежащего на сервере: отдать чек
          вложением умеет маршрут выдачи (`?download=1`), а локальный
          `blob:`-адрес этот запрос игнорирует и всё равно откроет файл.
          Такой файл человек и так держит у себя — качать его неоткуда.
        */}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden className="size-4" />
              Открыть оригинал
            </a>
          </Button>

          {isServerFile && (
            <Button asChild type="button" variant="outline" size="sm">
              <a href={`${src}?download=1`}>
                <Download aria-hidden className="size-4" />
                Скачать
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
