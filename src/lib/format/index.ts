/**
 * Представление: числа, даты и подписи в человеческом виде.
 *
 * Слой сознательно чистый — ни базы, ни `next/*`, ни часов. Всё, что зависит
 * от «сегодня», принимает его аргументом. Поэтому эти функции можно проверить
 * тестами без базы и браузера, а компоненты остаются тонкими.
 */

export {
  WEEKDAYS_SHORT,
  daysInMonth,
  firstDayOfMonth,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatMonth,
  formatMonthShort,
  formatRelativeDate,
  lastDayOfMonth,
  monthOf,
  rangesOverlap,
  shiftDateByMonths,
  shiftMonth,
  startOfWeek,
  weekdayIndex,
} from './dates';

export type { NamedUser } from './labels';
export {
  ABSENCE_TYPE_LABEL,
  CONTRIBUTION_STATUS_LABEL,
  CONTRIBUTION_STATUS_VARIANT,
  ROLE_LABEL,
  formatFileSize,
  fullName,
  initials,
  shortName,
} from './labels';

export type { PluralForms } from './plural';
export {
  BOTTLES,
  CONTRIBUTIONS,
  DAYS,
  EVENTS,
  ORDERS,
  PARTICIPANTS,
  PERSON_DAYS,
  pluralize,
  withCount,
} from './plural';
