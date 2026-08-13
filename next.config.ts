import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // SDL читается с диска в src/graphql/schema.ts — файл должен попасть в сборку.
  outputFileTracingIncludes: {
    '/api/graphql': ['./src/graphql/schema.graphql'],
  },
};

export default nextConfig;
