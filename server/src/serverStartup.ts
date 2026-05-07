import fs from "node:fs";
import path from "node:path";
import express from "express";
import { ensureTables } from "./db.js";
import {
  CLIENT_DIST_PATH,
  CLIENT_ORIGIN,
  CLIENT_ROOT,
  NODE_ENV,
  PORT,
} from "./appConfig.js";
import { getSharedCapsuleOgMetadata } from "./capsuleStore.js";
import { isApiPath } from "./capsuleHttp.js";
import { injectSharedCapsuleMetaTags } from "./sharedCapsuleMeta.js";
import { logInfo } from "./logger.js";

export function createStartServer(app) {
  /* eslint-disable complexity */
  return async ({
    appInstance = app,
    nodeEnv = NODE_ENV,
    ensureTablesImpl = ensureTables,
    port = PORT,
    clientOrigin = CLIENT_ORIGIN,
    clientDistPath = CLIENT_DIST_PATH,
    clientRoot = CLIENT_ROOT,
    getSharedCapsuleOgMetadataImpl = getSharedCapsuleOgMetadata,
    createViteServerImpl = null,
    existsSyncImpl = fs.existsSync,
    readFileImpl = fs.promises.readFile,
    expressStaticImpl = express.static,
    injectSharedCapsuleMetaTagsImpl = injectSharedCapsuleMetaTags,
    isApiPathImpl = isApiPath,
    logInfoImpl = logInfo,
  } = {}) => {
    await ensureTablesImpl();

    if (nodeEnv === "development") {
      const createViteServer =
        createViteServerImpl || (await import("vite")).createServer;
      const vite = await createViteServer({
        root: CLIENT_ROOT,
        server: {
          middlewareMode: true,
          watch: {
            // Ignore client env files to avoid endless Vite restarts in dev middleware mode.
            ignored: ["**/.env", "**/.env.*"],
          },
        },
      });
      appInstance.use(vite.middlewares);

      appInstance.use("*", async (req, res, next) => {
        if (isApiPathImpl(req.path)) {
          return next();
        }

        try {
          const htmlPath = path.join(clientRoot, "index.html");
          const template = await readFileImpl(htmlPath, "utf-8");
          const html = await vite.transformIndexHtml(req.originalUrl, template);
          const htmlWithMetaTags = await injectSharedCapsuleMetaTagsImpl(
            html,
            req,
            getSharedCapsuleOgMetadataImpl,
            { clientOrigin },
          );
          res
            .status(200)
            .set({ "Content-Type": "text/html" })
            .end(htmlWithMetaTags);
        } catch (error) {
          vite.ssrFixStacktrace(error);
          next(error);
        }
        return undefined;
      });
    } else if (existsSyncImpl(clientDistPath)) {
      appInstance.use(expressStaticImpl(clientDistPath));

      appInstance.get("*", async (req, res, next) => {
        if (isApiPathImpl(req.path)) {
          return res.status(404).json({ error: "not_found" });
        }
        try {
          const html = await readFileImpl(
            path.join(clientDistPath, "index.html"),
            "utf-8",
          );
          const htmlWithMetaTags = await injectSharedCapsuleMetaTagsImpl(
            html,
            req,
            getSharedCapsuleOgMetadataImpl,
            { clientOrigin },
          );
          return res
            .status(200)
            .set({ "Content-Type": "text/html" })
            .end(htmlWithMetaTags);
        } catch (error) {
          return next(error);
        }
      });
    }

    return appInstance.listen(port, () => {
      logInfoImpl(`Server listening on http://localhost:${port}`);
    });
  };
  /* eslint-enable complexity */
}
