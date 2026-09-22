'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { ReceiptPreview } from '@/components/receipt-preview';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatFileSize } from '@/lib/format';
import { MAX_RECEIPT_BYTES, RECEIPT_ACCEPT } from '@/lib/receipts/file';

/**
 * Поле выбора чека с предпросмотром до отправки (§6.5).
 *
 * Клиентский компонент по необходимости: предпросмотр читает выбранный файл
 * браузерным `URL.createObjectURL`, ничего не отправляя на сервер, — чтобы
 * человек увидел, что приложил тот чек, а не соседний файл из папки.
 *
 * Адрес объекта освобождается при смене файла и при уходе компонента: иначе
 * браузер держит выбранные файлы в памяти до перезагрузки страницы.
 *
 * После завершения действия React 19 сбрасывает неконтролируемую форму
 * (`requestFormReset`) — независимо от того, успешно оно завершилось или
 * отказало: и то и другое одинаково означает «действие с этим файлом
 * закончено». Само `<input type="file">` от этого пустеет, а `picked` —
 * состояние этого компонента, а не поля, — само по себе не заметило бы
 * сброса. Ловим момент через `useFormStatus`: `pending` живёт в контексте
 * ближайшей формы, значит хук работает и здесь, хотя поле — не сама форма;
 * переход `true → false` — это и есть завершение отправки. Альтернатива —
 * пересоздавать поле по `key` из родителя — работает так же, но заставила
 * бы владеть ключом состояние формы целиком там, где сейчас достаточно этого
 * компонента.
 */
export function ReceiptField({
  name = 'receipt',
  id = 'order-receipt',
}: {
  name?: string;
  id?: string;
}): ReactNode {
  const [picked, setPicked] = useState<{ url: string; type: string; name: string; size: number } | null>(
    null,
  );

  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      // Отправка только что завершилась, и поле уже сброшено формой —
      // плашка выбранного файла обязана исчезнуть вместе с ним.
      setPicked(null);
    }
    wasPending.current = pending;
  }, [pending]);

  useEffect(() => {
    if (picked === null) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Чек</Label>

      <Input
        id={id}
        name={name}
        type="file"
        accept={RECEIPT_ACCEPT}
        required
        aria-describedby={`${id}-hint`}
        className="file:text-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setPicked(
            file === null
              ? null
              : { url: URL.createObjectURL(file), type: file.type, name: file.name, size: file.size },
          );
        }}
      />

      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        PDF или снимок экрана, до {Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Поставка
        отмечается только с подтверждением оплаты.
      </p>

      {picked !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground truncate">
            {picked.name} · {formatFileSize(picked.size)}
          </span>
          <ReceiptPreview
            src={picked.url}
            mediaType={picked.type}
            title="Выбранный чек"
            label="Предпросмотр"
            description="Файл ещё не отправлен — так он будет выглядеть у остальных."
          />
        </div>
      )}
    </div>
  );
}
