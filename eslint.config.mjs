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
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
