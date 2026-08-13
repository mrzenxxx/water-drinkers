import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.ts',
      'src/**/*.{test,spec}.tsx',
      // Ядро расчёта держит тесты отдельно от исходников — см. tests/calc/.
      'tests/**/*.{test,spec}.ts',
    ],
  },
});
