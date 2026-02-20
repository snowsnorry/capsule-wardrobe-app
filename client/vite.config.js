import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    plugins: [react()],
    server: {
      watch: {
        // 1Password env mounts can be FIFOs and emit frequent fs events.
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
