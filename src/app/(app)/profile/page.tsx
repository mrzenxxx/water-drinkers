import { AtSign, IdCard, LogOut, Scale } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Amount } from '@/components/amount';
import { IconChip } from '@/components/icon-chip';
import { ProfileForm } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logoutAction } from '@/lib/actions/session';
import { requirePageUser } from '@/lib/auth/current-user';
import { toIsoDate } from '@/lib/data';
import { fundState } from '@/lib/data/queries';
import { ROLE_LABEL, formatLongDate } from '@/lib/format';
import { pageTitle } from '@/lib/view/app';

/**
 * Профиль участника.
 *
 * Сюда ведёт имя в шапке — и на узком экране, где имени не видно, значок
 * рядом с ним. Экран отвечает на три вопроса: «что приложение обо мне знает»,
 * «как поправить имя» и «как отсюда выйти». Личных данных ровно три — почта,
 * имя, фамилия (правило 7 CLAUDE.md); всё остальное здесь — не о человеке,
 * а о его положении в фонде.
 *
 * Выход стоит здесь, а не в шапке: он редкий и необратимый, а место рядом с
 * ежедневной навигацией делало его случайно нажимаемым. Ищут его там же, где
 * всё остальное про свою учётную запись.
 *
 * Карточки стоят сеткой два на два, а не столбиком: вчетвером в одну колонку
 * они занимали два экрана по высоте, оставляя половину ширины пустой. Порядок
 * чтения сетка не меняет — он тот же, что в разметке: имя и учётная запись
 * сверху, баланс и выход под ними. На узком экране колонка одна, и это тот же
 * порядок, просто вытянутый в линию.
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
    <div className="flex flex-col gap-6">
      <title>{pageTitle('Профиль')}</title>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Профиль</h1>
        <p className="text-muted-foreground text-sm">
          Приложение хранит о вас только рабочую почту, имя и фамилию.
        </p>
      </header>

      {/*
        Две колонки с `lg`, а не с `md`: в колонке уже 360 пикселей список
        «Логин — Почта — Роль» ломается на две строки в каждой паре, и
        карточка читается хуже, чем в одну колонку во всю ширину.
      */}
      <div className="grid gap-6 lg:grid-cols-2">
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
            {user.restriction === 'MUTED' ? (
              <p className="text-sm">
                {user.lastName} {user.firstName} {user.middleName}
              </p>
            ) : (
              <ProfileForm firstName={user.firstName ?? ''} lastName={user.lastName ?? ''} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconChip icon={AtSign} size="sm" />
              <CardTitle>Учётная запись</CardTitle>
            </div>
            <CardDescription>
              Логин, пароль и роль меняет администратор — обратитесь к нему.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/*
              `break-words` не украшение: почта вида
              `e.kondobarov@sspk.spb.ru` — одно слово без пробелов, и в
              половинной колонке она иначе вылезает за край карточки.
            */}
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Логин</dt>
              <dd className="font-mono font-medium break-words">{user.login}</dd>

              {user.email !== null && (
                <>
                  <dt className="text-muted-foreground">Почта</dt>
                  <dd className="font-medium break-words">{user.email}</dd>
                </>
              )}

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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <IconChip icon={LogOut} size="sm" />
              <CardTitle>Выход</CardTitle>
            </div>
            <CardDescription>
              Сессия закроется на этом устройстве. Чтобы вернуться, понадобятся
              логин и пароль.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Форма с серверным действием: выход меняет состояние, а не читает его. */}
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                <LogOut aria-hidden className="size-4" />
                Выйти из аккаунта
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
