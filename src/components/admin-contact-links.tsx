import type { ReactNode } from 'react';

import { MaxMark, TelegramMark } from '@/components/brand-marks';
import { cn } from '@/lib/utils';
import type { AdminContact, AdminContactId } from '@/lib/view/admin-contact';

/**
 * Связь с администратором: текст и два знака мессенджеров.
 *
 * Раньше здесь стояла кнопка «Связаться с администратором» со словами внутри,
 * и вела она в один Telegram. Мессенджеров стало два, а кнопка со словами
 * плохо превращается в две: «Связаться с администратором в Telegram» и
 * «…в MAX» рядом — это строка длиннее самого подвала. Поэтому слова сказаны
 * один раз, а выбор отдан знакам: две плитки, по одной на мессенджер, каждая
 * размером с кнопку и с подписью для чтения с экрана.
 *
 * Знаки стоят списком, а не просто в ряд: это перечень равноправных способов
 * написать, и читалке стоит сказать, что их два.
 *
 * Плитка чуть больше самого знака и стеклянная, как второстепенные кнопки:
 * цветное пятно на стекле — это и есть вся кнопка, рамке остаётся только
 * обозначить её край и отозваться на наведение. Её размер — 40 пикселей, а не
 * размер знака: по знаку в 24 пикселя пальцем не попасть.
 */

const MARK: Record<AdminContactId, (props: { className?: string }) => ReactNode> = {
  telegram: TelegramMark,
  max: MaxMark,
};

type AdminContactLinksProps = {
  contacts: AdminContact[];
  /** Слова перед знаками. Без них остаются одни плитки. */
  label?: string;
  /** Вертикально — на экране входа, где всё выровнено по середине. */
  stacked?: boolean;
  className?: string;
};

export function AdminContactLinks({
  contacts,
  label,
  stacked = false,
  className,
}: AdminContactLinksProps): ReactNode {
  // Вести в никуда хуже, чем не звать: без единого адреса блока нет вовсе.
  if (contacts.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-x-3 gap-y-2',
        stacked ? 'flex-col' : 'flex-wrap',
        className,
      )}
    >
      {label !== undefined && <span className="text-muted-foreground">{label}</span>}

      <ul className="flex items-center gap-2">
        {contacts.map((contact) => {
          const Mark = MARK[contact.id];
          const title = `Написать администратору в ${contact.label}`;

          return (
            <li key={contact.id}>
              <a
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                aria-label={title}
                className="glass-soft press hover:border-primary/50 focus-visible:ring-ring focus-visible:ring-offset-background flex size-10 items-center justify-center rounded-xl transition-[border-color,box-shadow] duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Mark className="size-6" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
