/**
 * Скаляры схемы (§10.2).
 *
 * Скаляр — граница типов приложения: всё, что приходит снаружи, проходит
 * через `parseValue`/`parseLiteral`, всё, что уходит наружу, — через
 * `serialize`. Поэтому проверка стоит именно здесь, а не только в резолверах:
 * резолвер можно забыть, границу — нет.
 *
 * Ни один скаляр не «чинит» негодное значение молча. Прежняя реализация
 * возвращала `0` на дробный литерал денег и пустую строку на нестроковую дату:
 * запрос проходил, а в базу уезжала неправда. Для денег это прямо запрещено
 * правилом 2 CLAUDE.md — дробная копейка ломает инвариант §5.
 */

import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

import { isIsoDate } from '@/lib/calc';
import { isKopecks } from '@/lib/money';

function inputError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

/**
 * Ошибка сериализации — это баг сервера, а не негодный ввод клиента.
 * Кода в `extensions` она не получает: клиенту тут нечего исправлять.
 */
function outputError(message: string): GraphQLError {
  return new GraphQLError(message);
}

/** YYYY-MM-DD */
export const DateScalar = new GraphQLScalarType<string, string>({
  name: 'Date',
  description: 'Календарная дата в формате YYYY-MM-DD',

  serialize: (value) => {
    if (typeof value !== 'string' || !isIsoDate(value)) {
      throw outputError(`Date: ожидалась дата YYYY-MM-DD, получено ${JSON.stringify(value)}`);
    }
    return value;
  },

  parseValue: (value) => {
    if (typeof value !== 'string' || !isIsoDate(value)) {
      throw inputError(`Date: ожидалась дата YYYY-MM-DD, получено ${JSON.stringify(value)}`);
    }
    return value;
  },

  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING || !isIsoDate(ast.value)) {
      throw inputError('Date: ожидалась строка вида "YYYY-MM-DD"');
    }
    return ast.value;
  },
});

/** ISO 8601 */
export const DateTimeScalar = new GraphQLScalarType<string, string>({
  name: 'DateTime',
  description: 'Момент времени в формате ISO 8601',

  serialize: (value) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw outputError(`DateTime: ожидался момент времени ISO 8601, получено ${JSON.stringify(value)}`);
    }
    return value;
  },

  parseValue: (value) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      throw inputError(`DateTime: ожидался момент времени ISO 8601, получено ${JSON.stringify(value)}`);
    }
    return value;
  },

  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING || Number.isNaN(Date.parse(ast.value))) {
      throw inputError('DateTime: ожидалась строка ISO 8601');
    }
    return ast.value;
  },
});

/**
 * Деньги — целое число копеек (§2.2).
 *
 * Дробное значение отвергается, а не округляется: округление на границе API
 * означало бы, что сумма в базе тихо разошлась с суммой, которую отправил
 * клиент. `Kind.FLOAT` называется в сообщении отдельно — это самая частая
 * ошибка, «250.50 рублей» вместо 25050 копеек.
 */
export const MoneyScalar = new GraphQLScalarType<number, number>({
  name: 'Money',
  description: 'Сумма в копейках, целое число',

  serialize: (value) => {
    const amount = typeof value === 'bigint' ? Number(value) : value;
    if (!isKopecks(amount)) {
      throw outputError(`Money: сумма должна быть целым числом копеек, получено ${JSON.stringify(value)}`);
    }
    return amount;
  },

  parseValue: (value) => {
    if (!isKopecks(value)) {
      throw inputError(`Money: сумма должна быть целым числом копеек, получено ${JSON.stringify(value)}`);
    }
    return value;
  },

  parseLiteral: (ast) => {
    if (ast.kind === Kind.FLOAT) {
      throw inputError('Money: сумма задаётся целым числом копеек, а не рублями с дробной частью');
    }
    if (ast.kind !== Kind.INT) {
      throw inputError('Money: ожидалось целое число копеек');
    }

    const amount = Number.parseInt(ast.value, 10);
    if (!isKopecks(amount)) {
      throw inputError(`Money: сумма вне диапазона точного целого: ${ast.value}`);
    }
    return amount;
  },
});

/** Произвольный JSON — для before/after в журнале аудита. */
export const JSONScalar = new GraphQLScalarType<unknown, unknown>({
  name: 'JSON',
  description: 'Произвольная JSON-структура',
  serialize: (value) => value,
  parseValue: (value) => value,
});
