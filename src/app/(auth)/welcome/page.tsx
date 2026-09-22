import { Droplets } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ProfileForm } from '@/components/profile-form';
import { hasProfile, requirePageUser } from '@/lib/auth/current-user';
import { pageTitle } from '@/lib/view/app';

/**
 * Знакомство после первого входа (§7): имя и фамилия. Нужно только тем, кого
 * завели до выдачи логинов: сейчас ФИО вводит администратор.
 *
 * Лежит вне группы `(app)`: её layout как раз и отправляет сюда участника
 * без имени, и попади страница внутрь — вышел бы бесконечный редирект.
 * Отсюда же и отдельный адрес `/welcome`: `/profile` занят постоянным экраном
 * профиля, который живёт уже внутри оболочки приложения.
 * Данные читаются серверным компонентом с `await`, без `useEffect`.
 */
/** Экран целиком зависит от сессии — предрендерить его нечем (см. `(app)/layout.tsx`). */
export const dynamic = 'force-dynamic';

export default async function WelcomePage(): Promise<ReactNode> {
  const user = await requirePageUser();
  // Заполненный профиль сюда ходить незачем: экран одноразовый. Правки имени
  // живут на `/profile`.
  if (hasProfile(user)) redirect('/profile');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <title>{pageTitle('Знакомство')}</title>

      {/* Тот же стеклянный вход, что и на форме входа: экран знакомства — его продолжение. */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        <header className="space-y-3">
          <span className="droplet-mark flex size-12 items-center justify-center rounded-2xl">
            <Droplets aria-hidden className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Как вас зовут?</h1>
          <p className="text-muted-foreground text-sm">
            Имя и фамилия нужны, чтобы в списках взносов и заказов было видно, кто есть кто.
            Вы вошли как <span className="text-foreground font-mono font-medium">{user.login}</span>.
          </p>
        </header>

        <div className="mt-6">
          <ProfileForm
            firstName={user.firstName ?? ''}
            lastName={user.lastName ?? ''}
            redirectTo="/"
            submitLabel="Продолжить"
          />
        </div>
      </div>
    </main>
  );
}
