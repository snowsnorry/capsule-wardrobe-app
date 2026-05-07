import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: 'server',
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "threads",
    fileParallelism: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "../coverage/server",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/**/*.child.ts",
        "src/test/**/*.ts",
        "src/db.ts",
        "src/ai/promptImages.ts"
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
