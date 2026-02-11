import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const disablePwa =
    process.env.DISABLE_PWA === "true" || process.env.VITE_DISABLE_PWA === "true";
  const enablePwa = !disablePwa;

  return {
    plugins: [
      react(),
      enablePwa &&
        VitePWA({
          registerType: "autoUpdate",
          devOptions: {
            enabled: true
          },
          manifest: {
            name: "Capsule Wardrobe",
            short_name: "Wardrobe",
            start_url: "/",
            display: "standalone",
            background_color: "#f7f4ef",
            theme_color: "#1c7c7c",
            icons: [
              {
                src: "/icons/icon-192.svg",
                sizes: "192x192",
                type: "image/svg+xml",
                purpose: "any"
              },
              {
                src: "/icons/icon-512.svg",
                sizes: "512x512",
                type: "image/svg+xml",
                purpose: "any"
              }
            ]
          }
        })
    ].filter(Boolean),
    server: {
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
