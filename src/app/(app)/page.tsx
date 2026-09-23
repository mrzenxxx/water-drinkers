import { Coins, Pin, Users, Wallet, Waves, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ActivityFeed } from '@/components/activity-feed';
import { Amount, HeroAmount } from '@/components/amount';
import { IconChip } from '@/components/icon-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requirePageUser } from '@/lib/auth/current-user';
import { todayIso } from '@/lib/data';
import { fundState, listAnnouncements, listPeople, peopleById, timelineSource } from '@/lib/data/queries';
import { fullName } from '@/lib/format';
import { formatKopecks } from '@/lib/money';
import { buildEvents } from '@/lib/view/events';
import { buildFeed, pinnedFeed } from '@/lib/view/feed';
import { cn } from '@/lib/utils';
import { pageTitle } from '@/lib/view/app';

/**
 * Главная (§6.1).
 *
 * Экран обязан читаться без чтения (§12): размер и цвет числа отвечают на
 * «должен или нет» раньше, чем человек дочитает подпись. Подпись при этом
 * стоит рядом всегда — цвет не единственный носитель смысла.
 *
 * Серверный компонент: данные берутся `await`-ом прямо из слоя данных,
 * без HTTP к собственному `/api/graphql` (§12а).
 */

/** Сколько элементов показывать в ленте. Дальше — дашборд и раздел объявлений. */
const FEED_LIMIT = 12;

/*
  ── Плотность карточек ────────────────────────────────────────────────────
  На главной карточек больше, чем на любом другом экране, и на телефоне они
  идут одной колонкой: то, что на мониторе стоит рядом, там выстраивается в
  длину. Отступ карточки по умолчанию (24px со всех сторон) на такой странице
  съедает экран быстрее содержимого, поэтому на узком экране он ужимается до
  16px и возвращается к обычному с `sm`.

  Отступы задаются здесь, а не в самом `Card`: стеклянная поверхность,
  скругление и блик — общие для всего приложения и живут в `globals.css`,
  а плотность — свойство конкретного экрана.
*/
const HEAD = 'p-4 pb-3 sm:p-6 sm:pb-4';
const BODY = 'px-4 pb-4 sm:px-6 sm:pb-6';

/*
  ── Один макет на все карточки ────────────────────────────────────────────
  Значок слева, рядом заголовок, под ними пояснение, дальше содержимое. До
  этого карточки с числом были устроены иначе — подпись мелким шрифтом, под
  ней число, значок отжат в правый угол, — и три карточки одной колонки
  читались как три разных экрана. Крупное число никуда не делось, просто
  стоит оно теперь в теле карточки, а не вместо её заголовка.
*/
function CardHead({
  icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone?: 'water' | 'owes';
  title: string;
  /**
   * Пояснение под заголовком. На телефоне уходит: там дорога каждая строка.
   * Необязательно — карточке, которую заголовок описывает исчерпывающе, вторая
   * строка не нужна.
   */
  children?: ReactNode;
}): ReactNode {
  return (
    <CardHeader className={HEAD}>
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} />
        <CardTitle>{title}</CardTitle>
      </div>
      {children !== undefined && (
        <CardDescription className="hidden sm:block">{children}</CardDescription>
      )}
    </CardHeader>
  );
}

export default async function HomePage(): Promise<ReactNode> {
  const user = await requirePageUser();

  const [state, people, byId, source, announcements] = await Promise.all([
    fundState(),
    listPeople(),
    peopleById(),
    timelineSource(),
    listAnnouncements(),
  ]);

  const today = todayIso();
  const myBalance = state.balanceOf(user.id);
  const amount = myBalance?.amount ?? 0;
  const owes = amount < 0;

  // Очередь должников видна всем — это обещание брифа, а не утечка (§6.1).
  const debtors = state.result.balances
    .filter((balance) => balance.amount < 0)
    .sort((a, b) => a.amount - b.amount);

  /**
   * Два списка, а не один. Лента — события фонда и объявления администратора
   * (§6.12) одним потоком, свежее сверху; закреплённые вынуты из неё в свой
   * блок. Закрепление означает «не тонуть», а лента отсортирована по дате, и
   * в ней закреплённое уезжало под каждый новый заказ.
   *
   * Объявление при этом событием фонда не стало — суммы у него нет, в расчёт
   * балансов оно не входит и на таймлайне дашборда (§6.9) не появляется;
   * сводятся они на уровне экрана, чистыми функциями из `lib/view/feed.ts`.
   *
   * Отметку «прочитано» ставит только раздел: погаси её главная — человек
   * увидел бы заголовок и никогда не прочёл бы текст. Поэтому непрочитанное
   * здесь помечено значком «Новое», но непрочитанным и остаётся.
   */
  const seenAt = user.announcementsSeenAt?.toISOString() ?? null;
  const feed = buildFeed({
    events: buildEvents(source),
    announcements,
    seenAt,
    limit: FEED_LIMIT,
  });
  const pinned = pinnedFeed({ announcements, seenAt });

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <title>{pageTitle('Главная')}</title>

      {/*
        Две колонки, а не сетка плиток. Слева — состояние кассы сверху вниз в
        порядке личной важности: «сколько с меня», «сколько у нас», «кто ещё
        должен». Справа — лента, единственный блок с непредсказуемой высотой.

        Соотношение 5:7 (≈ 42% / 58% от 1152px внутренней ширины): левой
        колонке остаётся около 470px — крупное число помещается в строку и
        не переносится, — а лента получает ~660px, на которых строка события
        «Взнос · 3 дня назад · подтверждён» ложится в одну строчку, ради чего
        колонки и разводились. При 2:3 лента выигрывала бы ещё сорок пикселей,
        но баланс начинал переноситься; при 1:1 лента теряла бы строку на
        каждом втором событии.

        `items-start`: колонки тянутся по своему содержимому, а не по соседке,
        иначе рядом с короткой очередью должников повисало полэкрана пустого
        стекла.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <div className="flex flex-col gap-4 lg:gap-6">
          {/*
            Личный баланс — первый и самый крупный: человек заходит сюда, чтобы
            узнать, должен он или нет.
          */}
          <Card className={owes ? 'border-owes/50' : undefined}>
            {/*
              Пояснение — второй заход для тех, кому короткой строки мало.
              На телефоне оно уходит: там уже сказано и числом, и строкой под
              ним, а три лишние строки текста отжимают ленту за край экрана.
            */}
            <CardHead icon={Wallet} tone={owes ? 'owes' : 'water'} title="Ваш баланс">
              {owes
                ? 'Внесите взнос и приложите чек — администратор подтвердит его, и баланс обновится.'
                : 'Взносы покрывают вашу долю в заказах. Как только баланс уйдёт в минус, здесь появится сумма.'}
            </CardHead>
            <CardContent className={cn(BODY, 'space-y-2 sm:space-y-3')}>
              <HeroAmount
                value={amount}
                tone="auto"
                signed
                className="block text-3xl sm:text-4xl lg:text-5xl"
              />
              <p className={owes ? 'text-owes font-medium' : 'text-credit font-medium'}>
                {owes
                  ? `Ты должен ${formatKopecks(-amount)}`
                  : 'Пока скидываться не надо'}
              </p>
              <Button asChild size="sm">
                <Link href="/contributions">Мои взносы</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHead icon={Coins} title="Остаток фонда">
              Деньги, которые есть у кассы прямо сейчас. Сумма балансов всех участников
              равна этому числу — сходимость видна в разделе «Фонд».
            </CardHead>
            <CardContent className={cn(BODY, 'space-y-2 sm:space-y-3')}>
              <HeroAmount
                value={state.result.fundBalance}
                tone="neutral"
                className="block text-3xl sm:text-4xl lg:text-5xl"
              />
              <p className="text-sm">
                Участников в составе:{' '}
                <span className="tabular font-medium">
                  {people.filter((person) => person.leftAt === null).length}
                </span>
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href="/fund">Раскрыть расчёт</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHead icon={Users} tone={debtors.length === 0 ? 'water' : 'owes'} title="Кто в минусе">
              Очередь видна всем: приложение прозрачно, участник видит то же, что администратор.
            </CardHead>
            <CardContent className={cn(BODY, 'space-y-3')}>
              {debtors.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Никто не должен фонду. Хороший день.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {debtors.map((balance) => {
                    const person = byId.get(balance.userId);
                    return (
                      <li
                        key={balance.userId}
                        className="border-border flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                      >
                        <span className="min-w-0 truncate">
                          {person === undefined ? balance.userId : fullName(person)}
                          {balance.userId === user.id && (
                            <span className="text-muted-foreground"> — это вы</span>
                          )}
                        </span>
                        <Amount value={balance.amount} tone="owes" signed />
                      </li>
                    );
                  })}
                </ul>
              )}

              {/*
                Очередь отвечает на «кто должен», а «сколько внёс каждый» —
                уже другой вопрос, и ответ на него в «Мы все». Ссылка стоит
                здесь потому, что спрашивают их подряд.
              */}
              <Button asChild size="sm" variant="outline">
                <Link href="/contributions/all">Взносы всех участников</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:gap-6">
          {/*
            Закреплённые стоят своим блоком над лентой, а не в ней. Лента
            отсортирована по дате, и закреплённое объявление уезжало вниз
            под каждый новый заказ воды — делало ровно то, от чего его
            закрепляли. Блока нет вовсе, когда закреплять нечего.
          */}
          {pinned.length > 0 && (
            <Card>
              <CardHead icon={Pin} title="Закреплённые уведомления" />
              <CardContent className={BODY}>
                <ActivityFeed items={pinned} people={byId} today={today} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHead icon={Waves} title="Лента событий">
              Взносы, заказы, отсутствия, корректировки и объявления — свежее сверху.
            </CardHead>
            <CardContent className={cn(BODY, 'space-y-4')}>
              <ActivityFeed items={feed} people={byId} today={today} />
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Весь таймлайн</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
