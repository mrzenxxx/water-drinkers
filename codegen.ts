import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Схема → типы TypeScript. Результат коммитится, чтобы сборка не зависела
 * от запуска codegen. После правки schema.graphql: npm run codegen.
 */
const config: CodegenConfig = {
  overwrite: true,
  schema: 'src/graphql/schema.graphql',
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        contextType: '../context#GraphQLContext',
        // Money — копейки, целое число (CLAUDE.md, правило 2).
        scalars: {
          Date: 'string',
          DateTime: 'string',
          Money: 'number',
          JSON: 'unknown',
        },
      },
    },
  },
};

export default config;
