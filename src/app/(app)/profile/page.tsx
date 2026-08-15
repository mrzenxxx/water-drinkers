import { AtSign, IdCard, Scale } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { IconChip } from '@/components/icon-chip';
import { ProfileForm } from '@/components/profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { toIsoDate } from '@/lib/data';
import { fundState } from '@/lib/data/queries';
import { ROLE_LABEL, formatLongDate } from '@/lib/format';

/**
 * Профиль участника.
 *
 * Сюда ведёт имя в шапке — и на узком экране, где имени не видно, значок
 * рядом с ним. Экран отвечает на два вопроса: «что приложение обо мне знает»
 * и «как поправить имя». Личных данных ровно три — почта, имя, фамилия
 * (правило 7 CLAUDE.md); всё остальное здесь — не о человеке, а о его
 * положении в фонде.
 *
 * Серверный компонент: данные читаются `await`-ом из слоя данных, без HTTP
 * к собственному `/api/graphql` (§12а). Клиентская часть — только форма.
 */
/** Экран зависит от сессии и состояния фонда — предрендерить его нечем. */
export const dynamic = 'force-dynamic';

export default async function ProfilePage(): Promise<ReactNode> {
  const user = await requirePageUser();
  const state = await fundState();

  const balance = state.balanceOf(user.id)?.amount ?? 0;
  const owes = balance < 0;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <title>Профиль — WaterDrinkers</title>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Профиль</h1>
        <p className="text-muted-foreground text-sm">
          Приложение хранит о вас только рабочую почту, имя и фамилию.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconChip icon={IdCard} size="sm" />
            <CardTitle>Имя и фамилия</CardTitle>
          </div>
          <CardDescription>
            Так вас видят в списках взносов, заказов и отсутствий.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm firstName={user.firstName ?? ''} lastName={user.lastName ?? ''} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconChip icon={AtSign} size="sm" />
            <CardTitle>Учётная запись</CardTitle>
          </div>
          <CardDescription>
            Почту и роль меняет администратор — обратитесь к нему.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Рабочая почта</dt>
            <dd className="font-medium">{user.email}</dd>

            <dt className="text-muted-foreground">Роль</dt>
            <dd className="font-medium">{ROLE_LABEL[user.role] ?? 'Участник'}</dd>

            <dt className="text-muted-foreground">В фонде с</dt>
            <dd className="font-medium">{formatLongDate(toIsoDate(user.joinedAt))}</dd>

            {user.leftAt !== null && (
              <>
                <dt className="text-muted-foreground">Вышел из фонда</dt>
                <dd className="font-medium">{formatLongDate(toIsoDate(user.leftAt))}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <IconChip icon={Scale} size="sm" tone={owes ? 'owes' : 'water'} />
            <CardTitle>Мой баланс</CardTitle>
          </div>
          <CardDescription>
            {/* Знак печатается всегда, цвет только подхватывает смысл (§12). */}
            {owes ? 'Пора скидываться.' : 'Внесено больше, чем потрачено на вас.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline justify-between gap-3">
          <Amount value={balance} tone="auto" signed className="text-2xl font-semibold" />
          <Link
            href="/contributions"
            className="text-primary text-sm underline underline-offset-4"
          >
            Мои взносы
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
