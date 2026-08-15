import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ProfileForm } from '@/components/profile-form';
import { hasProfile, requirePageUser } from '@/lib/auth/current-user';

/**
 * Знакомство после первого входа (§7): имя и фамилия.
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <title>Знакомство — WaterDrinkers</title>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Как вас зовут?</h1>
        <p className="text-muted-foreground text-sm">
          Имя и фамилия нужны, чтобы в списках взносов и заказов было видно, кто есть кто.
          Больше приложение о вас ничего не хранит — только рабочую почту{' '}
          <span className="text-foreground font-medium">{user.email}</span>.
        </p>
      </header>

      <ProfileForm
        firstName={user.firstName ?? ''}
        lastName={user.lastName ?? ''}
        redirectTo="/"
        submitLabel="Продолжить"
      />
    </main>
  );
}
