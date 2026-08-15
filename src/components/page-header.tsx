import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { IconChip } from '@/components/icon-chip';

/**
 * Заголовок экрана: значок раздела, название, одна поясняющая строка.
 *
 * До этого компонента шапка экрана была скопирована на каждой странице
 * дословно, и любая правка отступа означала правку в пяти местах. Значок
 * повторяет то, что уже написано в заголовке, и потому декоративен (§12):
 * экран одинаково понятен и без него.
 */
export function PageHeader({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <header className="flex items-start gap-3">
      <IconChip icon={icon} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children !== undefined && (
          <p className="text-muted-foreground mt-1 text-sm">{children}</p>
        )}
      </div>
    </header>
  );
}
