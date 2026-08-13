import { createYoga } from 'graphql-yoga';

import { createContext } from '@/graphql/context';
import { schema } from '@/graphql/schema';

const { handleRequest } = createYoga({
  schema,
  context: ({ request }) => createContext(request),
  // Next сам разбирает маршрут, Yoga должна знать свой путь целиком.
  graphqlEndpoint: '/api/graphql',
  // В Route Handler используются веб-стандартные Request/Response.
  fetchAPI: { Request, Response },
});

export { handleRequest as GET, handleRequest as POST, handleRequest as OPTIONS };

export const runtime = 'nodejs';
