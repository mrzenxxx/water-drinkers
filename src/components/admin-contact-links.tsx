import type { ReactNode } from 'react';

import { BRAND_FILL, MaxMark, TelegramMark } from '@/components/brand-marks';
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
 * Плитка целиком залита фирменным цветом мессенджера, а знак на ней — только
 * белый рисунок: одна цветная кнопка, а не цветной значок внутри светлой.
 * Её размер — 40 пикселей, а не размер знака: по знаку в 24 пикселя пальцем
 * не попасть. В жидком стекле плитка получает блик и свечение своего цвета
 * (`.badge-gloss`), как бейджики.
 */

const MARK: Record<AdminContactId, (props: { className?: string }) => ReactNode> = {
  telegram: TelegramMark,
  max: MaxMark,
};

/** Цвет свечения плитки в жидком стекле — середина фирменной заливки. */
const TONE: Record<AdminContactId, string> = {
  telegram: '#229ED9',
  max: '#6E0DFF',
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
                style={{ background: BRAND_FILL[contact.id], ['--badge-tone' as string]: TONE[contact.id] }}
                className="badge-gloss press focus-visible:ring-ring focus-visible:ring-offset-background flex size-10 items-center justify-center rounded-xl transition-[filter] duration-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Mark className="size-7" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
