import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Local test runner config: resolves workspace packages without a root install.
export default defineConfig({
  resolve: {
    alias: {
      '@leadloom/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
