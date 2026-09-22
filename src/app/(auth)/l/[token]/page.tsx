import { Droplets } from 'lucide-react';
import type { ReactNode } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { magicLinkLoginAction } from '@/lib/actions/session';
import { APP_NAME, pageTitle } from '@/lib/view/app';

/**
 * Вход по магической ссылке (ADR-0004).
 *
 * Страница ничего не делает при открытии — вход случается по кнопке. Telegram
 * и почтовые клиенты загружают ссылку ради превью, и мгновенный вход по GET
 * отдал бы их серверам настоящую сессию. Ссылка многоразовая до срока,
 * поэтому такое превью её и не тратит.
 */
export const dynamic = 'force-dynamic';

export default async function MagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<ReactNode> {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <title>{pageTitle('Вход по ссылке')}</title>
      <meta name="robots" content="noindex" />

      <div className="glass rounded-2xl p-6 text-center sm:p-8">
        <span className="droplet-mark mx-auto flex size-14 items-center justify-center rounded-2xl">
          <Droplets aria-hidden className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Вход в «{APP_NAME}»</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Ссылку прислал администратор. Нажмите кнопку, чтобы войти на этом устройстве.
        </p>

        <form action={magicLinkLoginAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <SubmitButton pendingLabel="Входим…" className="w-full">
            Войти
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
