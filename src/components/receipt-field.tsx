'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { ReceiptPreview } from '@/components/receipt-preview';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
 *
 * Исключение — отказ сервера: тогда `Form` возвращает отправленный файл в
 * поле, чтобы человек не выбирал его заново. Поэтому плашка гаснет, только
 * если поле после отправки действительно пусто.
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wasPending.current && !pending && (inputRef.current?.files?.length ?? 0) === 0) {
      // Отправка только что завершилась, и поле сброшено формой —
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
    <Field
      htmlFor={id}
      label="Чек"
      hint={`PDF или снимок экрана, до ${Math.round(MAX_RECEIPT_BYTES / 1024 / 1024)} МБ. Поставка отмечается только с подтверждением оплаты.`}
    >
      <Input
        ref={inputRef}
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

      {picked !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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
    </Field>
  );
}
