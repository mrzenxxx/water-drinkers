import { Droplets } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminContactLinks } from '@/components/admin-contact-links';
import { LoginForm } from '@/components/login-form';
import { adminContactsFromEnv } from '@/lib/view/admin-contact';
import { APP_NAME, pageTitle } from '@/lib/view/app';

/**
 * Вход (§7, ADR-0004): логин и пароль, выданные администратором.
 *
 * Своей регистрации нет — учётные данные заводит администратор. «Присоединиться
 * к водопою» ведёт к нему в мессенджер, и мессенджеров два: Telegram
 * (`ADMIN_TELEGRAM_URL`) и MAX (`ADMIN_MAX_URL`). Первого нет у всех и с
 * рабочего компьютера он обычно не открывается, второй открывается, но стоит
 * не у каждого — выбор отдан человеку. Без переменных приглашения нет.
 * Схему адреса дописывает `adminContactHref`: `t.me/ivanov` без неё браузер
 * считает путём внутри сайта, и ссылка открывает свою же страницу 404.
 */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}): Promise<ReactNode> {
  const { link } = await searchParams;
  const contacts = adminContactsFromEnv();

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

        {contacts.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-4 border-t pt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Логин и пароль предоставляются администратором по запросу
            </p>
            {/*
              Слова приглашают, знаки выбирают мессенджер. Кнопка со словами
              внутри здесь не годится: их пришлось бы написать дважды, по разу
              на мессенджер, и карточка входа выросла бы вдвое ради одной мысли.
            */}
            <AdminContactLinks
              contacts={contacts}
              label="Присоединиться к водопою"
              stacked
              className="text-sm"
            />
          </div>
        )}
      </div>
    </main>
  );
}
