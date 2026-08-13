import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSchema } from 'graphql-yoga';

import { resolvers } from '@/graphql/resolvers';
import type { GraphQLContext } from '@/graphql/context';

/**
 * SDL живёт в отдельном .graphql-файле: из него же codegen делает типы,
 * так что схема и типы не могут разъехаться. Файл включается в трассировку
 * сборки через outputFileTracingIncludes в next.config.ts.
 */
const typeDefs = readFileSync(join(process.cwd(), 'src/graphql/schema.graphql'), 'utf8');

export const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });
