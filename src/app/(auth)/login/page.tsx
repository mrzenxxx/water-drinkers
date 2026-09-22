import { Droplets, Send } from 'lucide-react';
import type { ReactNode } from 'react';

import { LoginForm } from '@/components/login-form';
import { Button } from '@/components/ui/button';
import { adminTelegramHref } from '@/lib/view/admin-contact';
import { APP_NAME, pageTitle } from '@/lib/view/app';

/**
 * Вход (§7, ADR-0004): логин и пароль, выданные администратором.
 *
 * Своей регистрации нет — учётные данные заводит администратор. Кнопка
 * «Присоединиться к водопою» ведёт к нему в Telegram; адрес задаётся
 * `ADMIN_TELEGRAM_URL`, без него кнопки нет. Схему адреса дописывает
 * `adminTelegramHref`: `t.me/ivanov` без неё браузер считает путём внутри
 * сайта, и кнопка открывает свою же страницу 404.
 */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}): Promise<ReactNode> {
  const { link } = await searchParams;
  const telegramUrl = adminTelegramHref(process.env.ADMIN_TELEGRAM_URL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <title>{pageTitle('Вход')}</title>

      {/*
        Вход — первое, что человек видит. Карточка стоит стеклом на воде, и это
        единственное место, где знак приложения показан крупно.
      */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="droplet-mark flex size-14 items-center justify-center rounded-2xl">
            <Droplets aria-hidden className="size-7" />
          </span>
          <h1 className="text-gradient-water text-3xl font-semibold tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-muted-foreground text-sm">
            Фонд воды в офисе серьёзной организации
          </p>
        </header>

        {link === 'invalid' && (
          <p role="alert" className="text-destructive mt-6 text-sm">
            Ссылка для входа устарела или была заменена. Войдите по логину и паролю или попросите
            новую у администратора.
          </p>
        )}

        <div className="mt-8">
          <LoginForm />
        </div>

        {telegramUrl !== null && (
          <div className="mt-6 flex flex-col items-center gap-2 border-t pt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Логин и пароль предоставляются администратором по запросу
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                Присоединиться к водопою
              </a>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
