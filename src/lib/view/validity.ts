/**
 * Текст ошибки поля по его `ValidityState`.
 *
 * Браузер умеет проверять поля сам (`required`, `type="email"`, `max`), но
 * говорит об этом своим всплывающим окошком: его вид не настраивается, язык
 * берётся из системы, а формулировка («Заполните это поле.») не знает, что
 * это за поле. Проверку оставляем браузеру — она работает и без JavaScript,
 * — а слова и вид берём свои.
 *
 * Функция чистая и не трогает DOM: на вход — флаги проверки и атрибуты поля,
 * на выход — строка. Поэтому она проверяется тестом без браузера.
 */

import type { IsoDate } from '@/lib/calc/types';
import { formatDate } from '@/lib/format';

/** Флаги `ValidityState`, которые мы различаем. */
export type ValidityFlags = {
  valueMissing: boolean;
  typeMismatch: boolean;
  patternMismatch: boolean;
  tooLong: boolean;
  tooShort: boolean;
  rangeUnderflow: boolean;
  rangeOverflow: boolean;
  stepMismatch: boolean;
  badInput: boolean;
  customError: boolean;
};

/** То, что нужно знать о самом поле. */
export type ControlFacts = {
  /** `input`, `select` или `textarea` — строчными. */
  tag: string;
  /** Атрибут `type` у `input`; для остальных пустая строка. */
  type: string;
  min: string;
  max: string;
  minLength: number;
  maxLength: number;
  /** Своя формулировка из `data-error`: заменяет общую для неверного формата. */
  customMessage: string | null;
  /** Сообщение браузера — последний довод, если ничего из нашего не подошло. */
  browserMessage: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readableBound(value: string, type: string): string {
  return type === 'date' && ISO_DATE.test(value) ? formatDate(value as IsoDate) : value;
}

export function validityMessage(validity: ValidityFlags, control: ControlFacts): string {
  const { tag, type } = control;

  if (validity.valueMissing) {
    if (tag === 'select') return 'Выберите вариант из списка';
    if (type === 'file') return 'Приложите файл';
    if (type === 'date') return 'Укажите дату';
    if (type === 'checkbox' || type === 'radio') return 'Отметьте вариант';
    return 'Заполните поле';
  }

  if (validity.badInput) {
    if (type === 'date') return 'Дата введена не полностью';
    if (type === 'number') return 'Нужно число';
    return 'Значение не читается';
  }

  if (validity.typeMismatch) {
    if (type === 'email') return 'Нужен адрес почты вида name@example.ru';
    if (type === 'url') return 'Нужна ссылка вида https://…';
    return 'Значение не того вида';
  }

  if (validity.patternMismatch) {
    return control.customMessage ?? 'Значение не того вида';
  }

  if (validity.tooShort) return `Не короче ${control.minLength} символов`;
  if (validity.tooLong) return `Не длиннее ${control.maxLength} символов`;

  if (validity.rangeUnderflow) {
    const bound = readableBound(control.min, type);
    return type === 'date' ? `Не раньше ${bound}` : `Не меньше ${bound}`;
  }

  if (validity.rangeOverflow) {
    const bound = readableBound(control.max, type);
    return type === 'date' ? `Не позже ${bound}` : `Не больше ${bound}`;
  }

  if (validity.stepMismatch) return 'Проверьте значение';

  return control.customMessage ?? (control.browserMessage || 'Проверьте значение');
}
