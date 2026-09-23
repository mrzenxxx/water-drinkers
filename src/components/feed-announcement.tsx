import { ChevronDown, Megaphone } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AnnouncementBody, AnnouncementImage } from '@/components/announcement-card';
import { Badge } from '@/components/ui/badge';
import type { IsoDate } from '@/lib/calc/types';
import { formatRelativeDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { summarize, type AnnouncementView } from '@/lib/view/announcements';

/**
 * Объявление в ленте главной (§6.1, §6.12).
 *
 * Свёрнутое показывает заголовок и первые слова, развёрнутое — весь текст
 * и картинку. Раскрытие сделано на `<details>`: состояние «открыто» живёт
 * в самом элементе, поэтому компонент остаётся серверным и в бандл не едет.
 * Заодно это бесплатно даёт клавиатуру, чтение с экрана и поиск по странице —
 * браузер раскрывает `<details>`, найдя текст внутри свёрнутого блока.
 *
 * Раскрывается плавно: `.disclosure` в `globals.css` анимирует высоту самого
 * содержимого. Обёрткой этого не сделать — закрываясь, браузер убирает
 * содержимое из отрисовки сразу, и анимации закрытия просто не из чего
 * строить. Где нужных свойств нет, раскрытие мгновенное, как и было.
 *
 * Стекло здесь тише, чем у карточки (`glass-soft`): объявление стоит внутри
 * ленты и не должно выглядеть второй карточкой поверх первой.
 *
 * Значок вместо цветной точки события — намеренно. Точки в ленте закреплены
 * за пятью типами событий и слотами палитры (§12); объявление событием фонда
 * не является, и шестой цвет там, где пять уже на пределе различимости, спутал
 * бы обе шкалы. Рупор отличает его формой, а не цветом.
 */
export function FeedAnnouncement({
  item,
  date,
  today,
  unread,
}: {
  item: AnnouncementView;
  date: IsoDate;
  today: IsoDate;
  unread: boolean;
}): ReactNode {
  return (
    /*
      Боковые отступы живут не на плитке, а внутри неё: содержимое `<details>`
      при раскрытии обрезается по своим краям (`overflow: hidden` — цена
      анимации высоты), и картинка, выведенная за них отрицательным полем,
      просто исчезла бы по бокам. Нижнего отступа у плитки с картинкой нет
      вовсе — картинка сама становится её низом.
    */
    <details
      className={cn(
        'disclosure group glass-soft overflow-hidden rounded-lg py-2.5',
        item.image !== null && 'pb-0',
      )}
    >
      <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-start gap-3 rounded-md px-3 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <Megaphone aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium">{item.title}</p>

          {/*
            Первые слова видны только в свёрнутом виде: развернувшись,
            объявление показывает тот же текст целиком, и повторять его начало
            дважды незачем.
          */}
          <p className="text-muted-foreground mt-0.5 text-xs group-open:hidden">
            {summarize(item.body, 120)}
          </p>

          <p className="text-muted-foreground mt-0.5 text-xs">
            Объявление · {formatRelativeDate(date, today)}
          </p>
        </div>

        {unread && <Badge className="shrink-0">Новое</Badge>}

        {/*
          Стрелка декоративна: состояние «свёрнуто/развёрнуто» браузер
          сообщает сам, и подпись здесь читалась бы вслух вторым голосом.
        */}
        <ChevronDown
          aria-hidden
          className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        {/* Текст стоит под заголовком, отступив на ширину рупора слева. */}
        <div className="flex flex-col gap-3 pr-3 pl-10">
          <AnnouncementBody body={item.body} />

          <Link
            href="/notices"
            className="text-primary text-xs underline underline-offset-2"
          >
            Все объявления
          </Link>
        </div>

        {/*
          Картинка — во всю ширину плитки, вровень с её краями и в самом низу.
          Высота остаётся `auto`: картинка видна целиком, в своих пропорциях,
          без обрезки. Своих углов и рамки у неё здесь нет — нижние углы ей
          скругляет сама плитка (`overflow: hidden`), а вторая рамка рядом с
          рамкой плитки читалась бы вторым забором.
        */}
        {item.image !== null && (
          <AnnouncementImage
            image={item.image}
            className="w-full max-w-none rounded-none border-0"
          />
        )}
      </div>
    </details>
  );
}
