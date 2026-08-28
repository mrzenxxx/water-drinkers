import { Pin } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import type { NamedUser } from '@/lib/format';
import { fullName } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  parseAnnouncementBody,
  type AnnouncementImageView,
  type AnnouncementView,
} from '@/lib/view/announcements';

/**
 * Объявление администратора (§6.12).
 *
 * Серверный компонент: текст, дата и подпись автора — ничего интерактивного,
 * значит и в бандл ехать нечему.
 *
 * Текст разбирается чистой функцией и отрисовывается настоящими элементами
 * разметки — абзацами и списками. Ни `dangerouslySetInnerHTML`, ни библиотеки
 * Markdown: администратор пишет объявление в поле ввода, и его содержимое —
 * ввод, а не доверенная разметка.
 */
export function AnnouncementBody({ body }: { body: string }): ReactNode {
  const blocks = parseAnnouncementBody(body);

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      {blocks.map((block, index) => {
        // Ключ по позиции: блоки не переставляются и не удаляются поодиночке —
        // список целиком пересобирается из текста при каждой отрисовке.
        const key = `${block.kind}-${index}`;

        if (block.kind === 'paragraph') {
          return <p key={key}>{block.text}</p>;
        }

        const items = block.items.map((item, position) => (
          <li key={`${key}-${position}`}>{item}</li>
        ));

        return block.kind === 'steps' ? (
          <ol key={key} className="ml-5 flex list-decimal flex-col gap-1.5">
            {items}
          </ol>
        ) : (
          <ul key={key} className="ml-5 flex list-disc flex-col gap-1.5">
            {items}
          </ul>
        );
      })}
    </div>
  );
}

/**
 * Картинка объявления.
 *
 * Обычный `<img>`, а не `next/image`: оптимизатор ходит за картинкой отдельным
 * запросом без cookie сессии, а выдача закрыта входом
 * (`/api/notices/[id]/image`) — и получал бы 401 вместо картинки. Размеры
 * проставлены, поэтому место под неё резервируется заранее и текст не
 * подпрыгивает, когда она догрузится.
 */
export function AnnouncementImage({
  image,
  className,
}: {
  image: AnnouncementImageView;
  className?: string;
}): ReactNode {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      className={cn('border-border h-auto w-full max-w-lg rounded-lg border', className)}
    />
  );
}

/**
 * Карточка объявления.
 *
 * Закреплённое и непрочитанное помечаются знаком **и** словом: цвет и значок
 * здесь не единственные носители смысла (§12). Черновик и архив видит только
 * администратор — на его экране они подписаны прямо, чтобы он не принял
 * несохранённое за отправленное команде.
 */
export function AnnouncementCard({
  item,
  author,
  isNew,
}: {
  item: AnnouncementView;
  author: NamedUser | null;
  isNew: boolean;
}): ReactNode {
  return (
    <Card
      // Непрочитанное выделено рамкой, а не заливкой: заливка меняет фон под
      // текстом и утаскивает контраст на стекле (§12.1).
      className={isNew ? 'border-primary/60' : undefined}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <CardTitle className="flex items-center gap-2">
            {item.pinned && <Pin aria-hidden className="text-primary size-4 shrink-0" />}
            {item.title}
          </CardTitle>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {item.pinned && <Badge variant="outline">Закреплено</Badge>}
            {isNew && <Badge>Новое</Badge>}
            {item.publishedAt === null && <Badge variant="secondary">Черновик</Badge>}
            {item.archivedAt !== null && <Badge variant="secondary">В архиве</Badge>}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          {item.publishedAt === null
            ? `Не опубликовано, изменено ${formatDateTime(item.updatedAt)}`
            : formatDateTime(item.publishedAt)}
          {author === null ? '' : ` · ${fullName(author)}`}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <AnnouncementBody body={item.body} />

        {item.image !== null && <AnnouncementImage image={item.image} />}
      </CardContent>
    </Card>
  );
}
