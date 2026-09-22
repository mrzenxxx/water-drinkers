'use client';

import { Check, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { credentialsMessage, type IssuedCredentialsView } from '@/components/admin/credentials-state';
import { Button } from '@/components/ui/button';

/**
 * Выданные учётные данные и кнопка «Скопировать».
 *
 * Появляется только после записи в базу: копировать то, что ещё можно
 * поправить, значило бы отправить человеку данные, которые не заработают.
 * Пароль здесь показан в последний раз — в базе лежит лишь его отпечаток.
 */
export function CredentialsCard({ credentials }: { credentials: IssuedCredentialsView }): ReactNode {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(credentialsMessage(credentials));
      setCopied(true);
    } catch {
      // Буфер недоступен (не https, запрет браузера) — текст виден и так,
      // его можно выделить руками.
      setCopied(false);
    }
  }

  const expires = new Date(credentials.magicLinkExpiresAt).toLocaleDateString('ru-RU');

  return (
    <div className="border-credit/40 bg-credit/5 flex flex-col gap-3 rounded-lg border p-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted-foreground">Логин</dt>
        <dd className="font-mono">{credentials.login}</dd>
        <dt className="text-muted-foreground">Пароль</dt>
        <dd className="font-mono">{credentials.password}</dd>
        <dt className="text-muted-foreground">Ссылка для входа</dt>
        <dd className="font-mono break-all">{credentials.magicLinkUrl}</dd>
      </dl>
      <p className="text-muted-foreground text-xs">
        Ссылка действует до {expires} и открывается на любом устройстве. Пароль больше нигде
        не покажется — скопируйте его сейчас.
      </p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? 'Скопировано' : 'Скопировать'}
        </Button>
        <span role="status" className="sr-only">
          {copied ? 'Данные скопированы в буфер обмена' : ''}
        </span>
      </div>
    </div>
  );
}
