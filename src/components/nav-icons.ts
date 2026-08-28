import {
  CalendarOff,
  ChartLine,
  Droplets,
  House,
  Inbox,
  Megaphone,
  Package,
  PenLine,
  ScrollText,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { NavIcon } from '@/lib/view/nav';

/**
 * Ключ раздела → значок.
 *
 * Разбор стоит здесь, а не в `nav.ts`: сами значки — клиентские компоненты,
 * и через границу `'use client'` они не ездят. Список разделов возит строку,
 * а строка превращается в значок уже на клиентской стороне.
 */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  wallet: Wallet,
  people: Users,
  fund: Droplets,
  orders: Package,
  absences: CalendarOff,
  dashboard: ChartLine,
  notices: Megaphone,
  admin: ShieldCheck,
  queue: Inbox,
  entry: PenLine,
  journal: ScrollText,
};
