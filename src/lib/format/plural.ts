/**
 * Русское склонение числительных.
 *
 * `Intl.PluralRules` знает правило, но не знает форм слова, а таблица форм
 * всё равно нужна. Своё правило короче и не зависит от набора локалей в среде.
 */

export type PluralForms = readonly [one: string, few: string, many: string];

/** `1 день`, `2 дня`, `5 дней`. Принимает и отрицательные — по модулю. */
export function pluralize(count: number, forms: PluralForms): string {
  const n = Math.abs(Math.trunc(count));
  const tens = n % 100;
  const units = n % 10;

  if (tens >= 11 && tens <= 14) return forms[2];
  if (units === 1) return forms[0];
  if (units >= 2 && units <= 4) return forms[1];
  return forms[2];
}

/** `5` + формы → `«5 дней»`. */
export function withCount(count: number, forms: PluralForms): string {
  return `${count} ${pluralize(count, forms)}`;
}

export const DAYS: PluralForms = ['день', 'дня', 'дней'];
export const PERSON_DAYS: PluralForms = ['человеко-день', 'человеко-дня', 'человеко-дней'];
export const ORDERS: PluralForms = ['заказ', 'заказа', 'заказов'];
export const CONTRIBUTIONS: PluralForms = ['взнос', 'взноса', 'взносов'];
export const PARTICIPANTS: PluralForms = ['участник', 'участника', 'участников'];
export const BOTTLES: PluralForms = ['бутыль', 'бутыли', 'бутылей'];
export const EVENTS: PluralForms = ['событие', 'события', 'событий'];
