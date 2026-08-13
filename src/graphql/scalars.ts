import { GraphQLScalarType, Kind } from 'graphql';

/** YYYY-MM-DD */
export const DateScalar = new GraphQLScalarType<string, string>({
  name: 'Date',
  description: 'Календарная дата в формате YYYY-MM-DD',
  serialize: (value) => String(value),
  parseValue: (value) => String(value),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : ''),
});

/** ISO 8601 */
export const DateTimeScalar = new GraphQLScalarType<string, string>({
  name: 'DateTime',
  description: 'Момент времени в формате ISO 8601',
  serialize: (value) => String(value),
  parseValue: (value) => String(value),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? ast.value : ''),
});

/**
 * Деньги — целое число копеек. Дробные значения запрещены: они ломают
 * инвариант «Σ балансов == остаток фонда» (CLAUDE.md, правило 2).
 */
export const MoneyScalar = new GraphQLScalarType<number, number>({
  name: 'Money',
  description: 'Сумма в копейках, целое число',
  serialize: (value) => Number(value),
  parseValue: (value) => Number(value),
  parseLiteral: (ast) => (ast.kind === Kind.INT ? Number.parseInt(ast.value, 10) : 0),
});

/** Произвольный JSON — для before/after в журнале аудита. */
export const JSONScalar = new GraphQLScalarType<unknown, unknown>({
  name: 'JSON',
  description: 'Произвольная JSON-структура',
  serialize: (value) => value,
  parseValue: (value) => value,
});
