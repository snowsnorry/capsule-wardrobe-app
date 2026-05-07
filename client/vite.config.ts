import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    test: {
      name: 'client',
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json-summary", "lcov"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/**/*.spec.{ts,tsx}",
          "src/**/*.d.ts",
          "src/**/index.ts",
          "src/**/index.tsx",
          "src/main.tsx",
          "src/vite-env.d.ts"
        ],
        thresholds: {
          perFile: true,
          lines: 70,
          functions: 70,
          branches: 60,
          statements: 70
        }
      }
    },
    server: {
      watch: {
        // Ignore env files to avoid endless Vite restarts in local dev.
        ignored: ["**/.env", "**/.env.*"]
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "")
        },
        "/auth": "http://localhost:3000",
        "/profile": "http://localhost:3000",
        "/wardrobe": "http://localhost:3000",
        "/health": "http://localhost:3000"
      }
    }
  };
});
