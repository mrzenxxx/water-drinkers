/**
 * Подписи, общие для всех экранов.
 *
 * Собраны в одном месте не ради экономии строк, а ради согласованности:
 * «Ждёт подтверждения» на одном экране и «На проверке» на другом читаются
 * как два разных состояния, хотя это одно и то же `PENDING`.
 */

import type { AbsenceType, ContributionStatus } from '@/lib/calc/types';

/** Участник, у которого может не быть заполненного профиля (§7). */
export type NamedUser = {
  login: string;
  firstName?: string | null;
  lastName?: string | null;
};

/** «Иван Петров», а без имени — логин. */
export function fullName(user: NamedUser): string {
  const name = [user.firstName, user.lastName].filter((part) => (part ?? '') !== '').join(' ');
  return name === '' ? user.login : name;
}

/** «И. Петров» — для тесных мест: подписи графика, ячейки календаря. */
export function shortName(user: NamedUser): string {
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  if (last === '') return fullName(user);
  return first === '' ? last : `${first.slice(0, 1)}. ${last}`;
}

/** Две буквы для аватара-заглушки. */
export function initials(user: NamedUser): string {
  const first = (user.firstName ?? '').trim();
  const last = (user.lastName ?? '').trim();
  if (first === '' && last === '') return user.login.slice(0, 2).toUpperCase();
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
}

export const CONTRIBUTION_STATUS_LABEL: Record<ContributionStatus, string> = {
  PENDING: 'Ждёт подтверждения',
  CONFIRMED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

/**
 * Цвет статуса — всегда вместе с подписью (§12: цвет не единственный носитель
 * смысла), поэтому здесь только вариант значка, а текст берётся отдельно.
 */
export const CONTRIBUTION_STATUS_VARIANT: Record<
  ContributionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  CONFIRMED: 'default',
  REJECTED: 'destructive',
};

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  VACATION: 'Отпуск',
  SICK_LEAVE: 'Больничный',
};

/** Роли §3. Участник видит всё, администратор — ещё и меняет. */
export const ROLE_LABEL: Record<string, string> = {
  PARTICIPANT: 'Участник',
  ADMIN: 'Администратор',
};

/**
 * Размер файла человеческим языком: `1536` → `1,5 КБ` (§6.5).
 *
 * Дробная часть здесь допустима: это не деньги, а подпись кнопки, и правило
 * «только целые копейки» к ней не относится.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;

  const kb = bytes / 1024;
  // Переключаемся на МБ, когда KB приближается к 1024 (до округления),
  // чтобы не появилось «1024 КБ» рядом со строками вроде «1,5 МБ».
  if (kb < 1023.5) return `${round(kb)} КБ`;

  const mb = kb / 1024;
  // Симметрично для МБ→ГБ: предотвращаем «1024 МБ».
  if (mb < 1023.5) return `${round(mb)} МБ`;

  return `${round(mb / 1024)} ГБ`;
}

/** До десяти — с одним знаком после запятой, дальше он только мешает. */
function round(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0).replace('.0', '').replace('.', ',');
}
