import { Droplets, Send } from 'lucide-react';
import type { ReactNode } from 'react';

import { LoginForm } from '@/components/login-form';
import { Button } from '@/components/ui/button';

/**
 * Вход (§7, ADR-0004): логин и пароль, выданные администратором.
 *
 * Своей регистрации нет — учётные данные заводит администратор. Кнопка
 * «Получить у администратора» ведёт к нему в Telegram; адрес задаётся
 * `ADMIN_TELEGRAM_URL`, без него кнопки нет.
 */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}): Promise<ReactNode> {
  const { link } = await searchParams;
  const telegramUrl = process.env.ADMIN_TELEGRAM_URL?.trim() || null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <title>Вход — WaterDrinkers</title>

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
            WaterDrinkers
          </h1>
          <p className="text-muted-foreground text-sm">
            Логин и пароль выдаёт администратор.
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
            <p className="text-muted-foreground text-sm">Нет логина или забыли пароль?</p>
            <Button asChild variant="outline" className="w-full">
              <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden />
                Получить у администратора
              </a>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
