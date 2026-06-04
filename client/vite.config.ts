import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const EXACT_VENDOR_CHUNKS = new Map([
  ["react", "vendor-react"],
  ["react-dom", "vendor-react"],
  ["scheduler", "vendor-react"],
  ["stylis", "vendor-emotion"],
  ["recharts", "vendor-recharts"],
  ["victory-vendor", "vendor-recharts"],
  ["react-smooth", "vendor-recharts"],
  ["decimal.js-light", "vendor-recharts"],
]);

function getNodeModulePackageName(id: string) {
  const normalizedId = id.replace(/\\/g, "/");
  const nodeModulesIndex = normalizedId.lastIndexOf("/node_modules/");
  if (nodeModulesIndex === -1) {
    return null;
  }

  const packagePath = normalizedId.slice(nodeModulesIndex + 14);
  const parts = packagePath.split("/");
  if (parts[0]?.startsWith("@")) {
    return `${parts[0]}/${parts[1] || ""}`;
  }

  return parts[0] || null;
}

function manualChunks(id: string) {
  const packageName = getNodeModulePackageName(id);
  if (!packageName) {
    return undefined;
  }

  const exactChunk = EXACT_VENDOR_CHUNKS.get(packageName);
  if (exactChunk) {
    return exactChunk;
  }

  if (packageName.startsWith("@mui/")) {
    return "vendor-mui";
  }

  if (packageName.startsWith("@emotion/")) {
    return "vendor-emotion";
  }

  if (packageName.startsWith("d3-")) {
    return "vendor-recharts";
  }

  return undefined;
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ["recharts"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
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
        "/wardrobe/filters": "http://localhost:3000",
        "/wardrobe/items": "http://localhost:3000",
        "/health": "http://localhost:3000"
      }
    }
  };
});
