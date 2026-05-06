import fs from "node:fs";
import path from "node:path";
import express from "express";
import { ensureTables } from "./db.js";
import { CLIENT_DIST_PATH, CLIENT_ROOT, NODE_ENV, PORT } from "./appConfig.js";
import { getSharedCapsuleOgMetadata } from "./capsuleStore.js";
import { isApiPath } from "./capsuleHttp.js";
import { injectSharedCapsuleMetaTags } from "./sharedCapsuleMeta.js";
import { logInfo } from "./logger.js";

export function createStartServer(app) {
  return async ({
  appInstance = app,
  nodeEnv = NODE_ENV,
  ensureTablesImpl = ensureTables,
  port = PORT,
  clientDistPath = CLIENT_DIST_PATH,
  clientRoot = CLIENT_ROOT,
  getSharedCapsuleOgMetadataImpl = getSharedCapsuleOgMetadata
} = {}) => {
  await ensureTablesImpl();

  if (nodeEnv === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: CLIENT_ROOT,
      server: {
        middlewareMode: true,
        watch: {
          // 1Password env mounts can be FIFOs and emit frequent fs events.
          // Ignore client env files to avoid endless Vite restarts in dev middleware mode.
          ignored: ["**/.env", "**/.env.*"]
        }
      }
    });
    appInstance.use(vite.middlewares);

    appInstance.use("*", async (req, res, next) => {
      if (isApiPath(req.path)) {
        return next();
      }

      try {
        const htmlPath = path.join(clientRoot, "index.html");
        const template = await fs.promises.readFile(htmlPath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        const htmlWithMetaTags = await injectSharedCapsuleMetaTags(html, req, getSharedCapsuleOgMetadataImpl);
        res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithMetaTags);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
      return undefined;
    });
  } else if (fs.existsSync(clientDistPath)) {
    appInstance.use(express.static(clientDistPath));

    appInstance.get("*", async (req, res, next) => {
      if (isApiPath(req.path)) {
        return res.status(404).json({ error: "not_found" });
      }
      try {
        const html = await fs.promises.readFile(path.join(clientDistPath, "index.html"), "utf-8");
        const htmlWithMetaTags = await injectSharedCapsuleMetaTags(html, req, getSharedCapsuleOgMetadataImpl);
        return res.status(200).set({ "Content-Type": "text/html" }).end(htmlWithMetaTags);
      } catch (error) {
        return next(error);
      }
    });
  }

  return appInstance.listen(port, () => {
    logInfo(`Server listening on http://localhost:${port}`);
  });
  };
}
