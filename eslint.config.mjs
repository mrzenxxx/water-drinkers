import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      // Генерируется: src/generated — Prisma, src/graphql/generated — codegen.
      'src/generated/**',
      'src/graphql/generated/**',
      // Рабочие копии субагентов: полные клоны проекта со своими сборками.
      // Без этого линтер разбирает чужой .next и падает на тысячах замечаний.
      '.claude/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
