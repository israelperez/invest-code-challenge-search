import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { setupFiles: ['tests/setup-search-log-file.ts'] },
});
