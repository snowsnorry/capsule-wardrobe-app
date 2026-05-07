import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["shared/**/*.test.ts"],
    fileParallelism: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage/shared",
      include: ["shared/**/*.ts"],
      exclude: ["shared/**/*.test.ts", "shared/**/*.d.ts"],
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
