import { CircleCheck, CircleX, Clock3, type LucideIcon } from 'lucide-react';

import type { ContributionStatus } from '@/lib/calc/types';

/**
 * Значок статуса взноса.
 *
 * Лежит отдельным модулем, а не рядом с `ContributionStatusIcon`: тот помечен
 * `'use client'` ради подсказки при наведении, а те же значки нужны ленте на
 * главной — серверному компоненту. Через клиентскую границу компонент уехал бы
 * ссылкой на клиентскую сущность; отсюда он едет значением, как и значки
 * разделов в `nav-icons.ts`.
 *
 * У каждого статуса своя форма, поэтому цвет рядом ничего не несёт в
 * одиночку (§12): значок различим и в чёрно-белой печати.
 */
export const CONTRIBUTION_STATUS_ICON: Record<ContributionStatus, LucideIcon> = {
  PENDING: Clock3,
  CONFIRMED: CircleCheck,
  REJECTED: CircleX,
};
