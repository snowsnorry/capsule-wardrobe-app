// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      './client/vite.config.ts',
      './server/vitest.config.ts',
      './shared/vitest.config.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/test/**/*.ts",
        "**/*.spec.{ts,tsx}",
        "server/**/*.child.ts",
        "server/src/db.ts",
        "server/src/ai/promptImages.ts",
        "client/src/**/index.ts",
        "client/src/**/index.tsx",
        "client/src/main.tsx",
        "client/src/vite-env.d.ts"
      ],
      thresholds: {
        perFile: true,
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});