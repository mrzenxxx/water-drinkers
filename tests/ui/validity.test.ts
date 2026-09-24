import { describe, expect, it } from 'vitest';

import { validityMessage, type ControlFacts, type ValidityFlags } from '@/lib/view/validity';

const VALID: ValidityFlags = {
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooLong: false,
  tooShort: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false,
  customError: false,
};

const TEXT: ControlFacts = {
  tag: 'input',
  type: 'text',
  min: '',
  max: '',
  minLength: -1,
  maxLength: -1,
  customMessage: null,
  browserMessage: 'Please fill out this field.',
};

function flags(patch: Partial<ValidityFlags>): ValidityFlags {
  return { ...VALID, ...patch };
}

describe('текст ошибки поля', () => {
  it('пустое обязательное поле называет, чего не хватает', () => {
    expect(validityMessage(flags({ valueMissing: true }), TEXT)).toBe('Заполните поле');
    expect(validityMessage(flags({ valueMissing: true }), { ...TEXT, type: 'date' })).toBe('Укажите дату');
    expect(validityMessage(flags({ valueMissing: true }), { ...TEXT, type: 'file' })).toBe('Приложите файл');
    expect(validityMessage(flags({ valueMissing: true }), { ...TEXT, tag: 'select', type: '' })).toBe(
      'Выберите вариант из списка',
    );
  });

  it('границы дат показывает по-русски, а не в ISO', () => {
    const date = { ...TEXT, type: 'date', min: '2026-01-01', max: '2026-09-24' };
    expect(validityMessage(flags({ rangeOverflow: true }), date)).toBe('Не позже 24.09.2026');
    expect(validityMessage(flags({ rangeUnderflow: true }), date)).toBe('Не раньше 01.01.2026');
  });

  it('длину называет числом из атрибута', () => {
    expect(validityMessage(flags({ tooShort: true }), { ...TEXT, minLength: 8 })).toBe(
      'Не короче 8 символов',
    );
  });

  it('неверный формат берёт формулировку поля, если она есть', () => {
    expect(validityMessage(flags({ patternMismatch: true }), TEXT)).toBe('Значение не того вида');
    expect(
      validityMessage(flags({ patternMismatch: true }), { ...TEXT, customMessage: 'Рубли: 500,50' }),
    ).toBe('Рубли: 500,50');
  });

  it('почту узнаёт по типу поля', () => {
    expect(validityMessage(flags({ typeMismatch: true }), { ...TEXT, type: 'email' })).toBe(
      'Нужен адрес почты вида name@example.ru',
    );
  });

  it('пустота важнее прочих ошибок: сначала заполнить, потом проверять вид', () => {
    expect(
      validityMessage(flags({ valueMissing: true, typeMismatch: true }), { ...TEXT, type: 'email' }),
    ).toBe('Заполните поле');
  });

  it('неизвестная ошибка не остаётся без слов', () => {
    expect(validityMessage(flags({ customError: true }), TEXT)).toBe('Please fill out this field.');
    expect(validityMessage(flags({ customError: true }), { ...TEXT, browserMessage: '' })).toBe(
      'Проверьте значение',
    );
  });
});
