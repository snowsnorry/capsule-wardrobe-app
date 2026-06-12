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

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HTML_CACHE_CONTROL = "no-store";
const DEFAULT_APP_PATH = "/personal-items";

function getDefaultAppRedirectPath(req) {
  const queryStartIndex = String(req.originalUrl || "").indexOf("?");
  return `${DEFAULT_APP_PATH}${
    queryStartIndex >= 0 ? req.originalUrl.slice(queryStartIndex) : ""
  }`;
}

function redirectEmptyAppPath(req, res, next) {
  if (req.path === "/") {
    return res.redirect(302, getDefaultAppRedirectPath(req));
  }

  return next();
}

function setStaticHtmlHeaders(res, filePath) {
  if (path.basename(filePath) === "index.html") {
    res.setHeader("Cache-Control", HTML_CACHE_CONTROL);
  }
}

async function configureDevelopmentApp({
  appInstance,
  clientOrigin,
  clientRoot,
  createViteServerImpl,
  getSharedCapsuleOgMetadataImpl,
  injectSharedCapsuleMetaTagsImpl,
  isApiPathImpl,
  readFileImpl,
}) {
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
  appInstance.get("/", redirectEmptyAppPath);
  appInstance.use(vite.middlewares);

  appInstance.use(async (req, res, next) => {
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
}

function configureProductionApp({
  appInstance,
  clientDistPath,
  clientOrigin,
  expressStaticImpl,
  getSharedCapsuleOgMetadataImpl,
  injectSharedCapsuleMetaTagsImpl,
  isApiPathImpl,
  readFileImpl,
}) {
  appInstance.use(
    "/assets",
    expressStaticImpl(path.join(clientDistPath, "assets"), {
      immutable: true,
      index: false,
      maxAge: ONE_YEAR_MS,
    }),
  );
  appInstance.use(
    expressStaticImpl(clientDistPath, {
      index: false,
      setHeaders: setStaticHtmlHeaders,
    }),
  );

  appInstance.get("/{*splat}", async (req, res, next) => {
    if (req.path === "/") {
      return res.redirect(302, getDefaultAppRedirectPath(req));
    }

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
        .set({
          "Cache-Control": HTML_CACHE_CONTROL,
          "Content-Type": "text/html",
        })
        .end(htmlWithMetaTags);
    } catch (error) {
      return next(error);
    }
  });
}

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
      await configureDevelopmentApp({
        appInstance,
        clientOrigin,
        clientRoot,
        createViteServerImpl,
        getSharedCapsuleOgMetadataImpl,
        injectSharedCapsuleMetaTagsImpl,
        isApiPathImpl,
        readFileImpl,
      });
    } else if (existsSyncImpl(clientDistPath)) {
      configureProductionApp({
        appInstance,
        clientDistPath,
        clientOrigin,
        expressStaticImpl,
        getSharedCapsuleOgMetadataImpl,
        injectSharedCapsuleMetaTagsImpl,
        isApiPathImpl,
        readFileImpl,
      });
    }

    return appInstance.listen(port, () => {
      logInfoImpl(`Server listening on http://localhost:${port}`);
    });
  };
  /* eslint-enable complexity */
}
