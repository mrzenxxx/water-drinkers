import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    /**
     * Умолчание — 1 МБ, а картинка объявления (§6.12) допускается до 2 МБ:
     * форма с ней упиралась бы в лимит раньше, чем в собственную проверку,
     * и человек получал бы «Body exceeded 1 MB» вместо внятного отказа.
     * Запас сверх двух мегабайт — на обвязку multipart и остальные поля формы.
     */
    serverActions: { bodySizeLimit: '3mb' },
  },
  // SDL читается с диска в src/graphql/schema.ts — файл должен попасть в сборку.
  outputFileTracingIncludes: {
    '/api/graphql': ['./src/graphql/schema.graphql'],
  },
};

export default nextConfig;
