import { describe, expect, it } from 'vitest';

import { buildLogin, isValidLogin, normalizeLogin, transliterate, uniqueLogin } from '@/lib/auth/login-name';

describe('transliterate', () => {
  it('переводит кириллицу в латиницу', () => {
    expect(transliterate('Кондобаров')).toBe('kondobarov');
    expect(transliterate('Щукин')).toBe('shchukin');
    expect(transliterate('Хабибуллин')).toBe('khabibullin');
    expect(transliterate('Цой')).toBe('tsoy');
    expect(transliterate('Жуков')).toBe('zhukov');
    expect(transliterate('Юсупова')).toBe('yusupova');
    expect(transliterate('Ярцев')).toBe('yartsev');
  });

  it('ё как е, мягкий и твёрдый знаки выпадают', () => {
    expect(transliterate('Сёмин')).toBe('semin');
    expect(transliterate('Васильев')).toBe('vasilev');
    expect(transliterate('Подъячев')).toBe('podyachev');
  });

  it('сохраняет дефис двойной фамилии, выбрасывает пробелы и апострофы', () => {
    expect(transliterate('Римский-Корсаков')).toBe('rimskiy-korsakov');
    expect(transliterate("  Д'Артаньян ")).toBe('dartanyan');
    expect(transliterate('Иванов - Петров')).toBe('ivanov-petrov');
  });

  it('латиница проходит как есть, в нижнем регистре', () => {
    expect(transliterate('Smith')).toBe('smith');
  });
});

describe('buildLogin', () => {
  it('имя и фамилия', () => {
    expect(buildLogin({ firstName: 'Евгений', lastName: 'Кондобаров' })).toBe('e.kondobarov');
  });

  it('с отчеством', () => {
    expect(buildLogin({ firstName: 'Евгений', middleName: 'Викторович', lastName: 'Кондобаров' })).toBe(
      'e.v.kondobarov',
    );
  });

  it('пустое отчество — как без отчества', () => {
    expect(buildLogin({ firstName: 'Анна', middleName: '  ', lastName: 'Ким' })).toBe('a.kim');
    expect(buildLogin({ firstName: 'Анна', middleName: null, lastName: 'Ким' })).toBe('a.kim');
  });

  it('первая буква имени транслитерируется целиком', () => {
    expect(buildLogin({ firstName: 'Юрий', lastName: 'Щукин' })).toBe('yu.shchukin');
    expect(buildLogin({ firstName: 'Жанна', middleName: 'Юрьевна', lastName: 'Цой' })).toBe('zh.yu.tsoy');
  });

  it('без фамилии логина нет', () => {
    expect(buildLogin({ firstName: 'Анна', lastName: '  ' })).toBe('');
  });
});

describe('uniqueLogin', () => {
  it('свободный логин не меняется', () => {
    expect(uniqueLogin('e.kondobarov', ['a.kim'])).toBe('e.kondobarov');
  });

  it('занятый получает число, начиная с двойки', () => {
    expect(uniqueLogin('e.kondobarov', ['e.kondobarov'])).toBe('e.kondobarov2');
    expect(uniqueLogin('e.kondobarov', ['e.kondobarov', 'e.kondobarov2'])).toBe('e.kondobarov3');
  });

  it('сравнивает без учёта регистра', () => {
    expect(uniqueLogin('e.kondobarov', ['E.Kondobarov'])).toBe('e.kondobarov2');
  });
});

describe('isValidLogin', () => {
  it('принимает сгенерированные логины', () => {
    expect(isValidLogin('e.kondobarov')).toBe(true);
    expect(isValidLogin('e.v.rimskiy-korsakov2')).toBe(true);
  });

  it('отвергает кириллицу, пробелы, края и сдвоенные разделители', () => {
    expect(isValidLogin('кондобаров')).toBe(false);
    expect(isValidLogin('e kondobarov')).toBe(false);
    expect(isValidLogin('.kondobarov')).toBe(false);
    expect(isValidLogin('kondobarov-')).toBe(false);
    expect(isValidLogin('e..kondobarov')).toBe(false);
    expect(isValidLogin('ab')).toBe(false);
    expect(isValidLogin('a'.repeat(41))).toBe(false);
  });

  it('normalizeLogin приводит ввод к хранимому виду', () => {
    expect(normalizeLogin('  E.Kondobarov ')).toBe('e.kondobarov');
  });
});
