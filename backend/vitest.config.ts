import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../frontend/src', import.meta.url)),
      pinia: fileURLToPath(new URL('../frontend/node_modules/pinia/dist/pinia.mjs', import.meta.url)),
      vue: fileURLToPath(new URL('../frontend/node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.property.test.ts'],
    testTimeout: 30000,
  },
});
