import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "shared",
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "../coverage/shared",
      include: ["**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      thresholds: {
        perFile: true,
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
