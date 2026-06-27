import { test, expect, vi } from "vitest";
import fs from "node:fs";
import { createStartServer } from "./serverStartup.js";

function createAppRecorder() {
  const calls = [];
  const app = {
    calls,
    use(...args) {
      calls.push({ type: "use", args });
      return app;
    },
    get(...args) {
      calls.push({ type: "get", args });
      return app;
    },
    listen(port, callback) {
      calls.push({ type: "listen", port });
      callback?.();
      return { close() {} };
    },
  };
  return app;
}

function createResponse() {
  return {
    statusCode: 0,
    headers: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(headers) {
      this.headers = headers;
      return this;
    },
    end(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    redirect(code, path) {
      this.statusCode = code;
      this.headers = { Location: path };
      return this;
    },
  };
}

test("development startup wires Vite middleware and serves transformed capsule html", async () => {
  const app = createAppRecorder();
  const nextCalls = [];
  const fixedErrors = [];
  const viteOptions = [];
  const logMessages = [];

  await createStartServer(app)({
    nodeEnv: "development",
    port: 4123,
    clientRoot: "/client",
    ensureTablesImpl: async () => {},
    createViteServerImpl: async (options) => {
      viteOptions.push(options);
      return {
        middlewares: "vite-middleware",
        transformIndexHtml: async (url, html) => `${html}:${url}`,
        ssrFixStacktrace: (error) => fixedErrors.push(error),
      };
    },
    readFileImpl: (async (filePath) => {
      expect(filePath).toBe("/client/index.html");
      return "<html>";
    }) as unknown as typeof fs.promises.readFile,
    injectSharedCapsuleMetaTagsImpl: async (html, req) =>
      `${html}:meta:${req.path}`,
    isApiPathImpl: (requestPath) => requestPath.startsWith("/api"),
    logInfoImpl: (message) => logMessages.push(message),
  });

  expect(viteOptions[0].server.middlewareMode).toEqual(true);
  expect(app.calls[0].type).toBe("get");
  expect(app.calls[0].args[0]).toBe("/");
  expect(app.calls[1].type).toBe("use");
  expect(app.calls[1].args[0]).toBe("vite-middleware");
  expect(app.calls[2].type).toBe("use");
  expect(app.calls[2].args[0]).toEqual(expect.any(Function));
  expect(app.calls.at(-1)).toEqual({ type: "listen", port: 4123 });
  expect(logMessages).toEqual(["Server listening on http://localhost:4123"]);

  const rootRedirect = app.calls[0].args[1];
  const rootResponse = createResponse();
  rootRedirect({ path: "/", originalUrl: "/" }, rootResponse, (error) =>
    nextCalls.push(error),
  );
  expect(rootResponse.statusCode).toBe(302);
  expect(rootResponse.headers).toEqual({ Location: "/personal-items" });

  const rootQueryResponse = createResponse();
  rootRedirect(
    { path: "/", originalUrl: "/?oauthReturnTo=%2Foauth%2Fauthorize" },
    rootQueryResponse,
    (error) => nextCalls.push(error),
  );
  expect(rootQueryResponse.statusCode).toBe(302);
  expect(rootQueryResponse.headers).toEqual({
    Location: "/personal-items?oauthReturnTo=%2Foauth%2Fauthorize",
  });

  const handler = app.calls[2].args[0];
  await handler(
    { path: "/api/search", originalUrl: "/api/search" },
    createResponse(),
    (error) => nextCalls.push(error),
  );
  expect(nextCalls.length).toBe(1);
  expect(nextCalls[0]).toBe(undefined);

  const pageResponse = createResponse();
  await handler(
    { path: "/share/abc", originalUrl: "/share/abc?x=1" },
    pageResponse,
    (error) => nextCalls.push(error),
  );
  expect(pageResponse.statusCode).toBe(200);
  expect(pageResponse.headers).toEqual({ "Content-Type": "text/html" });
  expect(pageResponse.body).toBe("<html>:/share/abc?x=1:meta:/share/abc");
});

test("development startup fixes Vite stack traces before forwarding html errors", async () => {
  const app = createAppRecorder();
  const thrown = new Error("read failed");
  const fixedErrors = [];
  const nextCalls = [];

  await createStartServer(app)({
    nodeEnv: "development",
    ensureTablesImpl: async () => {},
    createViteServerImpl: async () => ({
      middlewares: "vite-middleware",
      transformIndexHtml: async () => "<html>",
      ssrFixStacktrace: (error) => fixedErrors.push(error),
    }),
    readFileImpl: async () => {
      throw thrown;
    },
    isApiPathImpl: () => false,
    logInfoImpl: () => {},
  });

  const handler = app.calls[2].args[0];
  await handler(
    { path: "/share/abc", originalUrl: "/share/abc" },
    createResponse(),
    (error) => nextCalls.push(error),
  );

  expect(fixedErrors).toEqual([thrown]);
  expect(nextCalls).toEqual([thrown]);
});

test("startup starts job workers after listen and stops them on server close", async () => {
  const calls: string[] = [];
  let closeListener: (() => void) | null = null;
  const app = {
    get: vi.fn(),
    use: vi.fn(),
    listen: vi.fn((_port, callback) => {
      calls.push("listen");
      callback?.();
      return {
        on: vi.fn((event, listener) => {
          if (event === "close") {
            closeListener = listener;
          }
        }),
      };
    }),
  };
  const startJobWorkersImpl = vi.fn(async () => {
    calls.push("start-workers");
  });
  const stopJobWorkersImpl = vi.fn(async () => {
    calls.push("stop-workers");
  });

  await createStartServer(app)({
    nodeEnv: "production",
    port: 4124,
    ensureTablesImpl: async () => {
      calls.push("ensure-tables");
    },
    existsSyncImpl: () => false,
    logInfoImpl: () => {},
    startJobWorkersImpl,
    stopJobWorkersImpl,
  });
  expect(calls).toEqual(["ensure-tables", "listen", "start-workers"]);
  expect(startJobWorkersImpl).toHaveBeenCalledTimes(1);
  closeListener?.();
  expect(stopJobWorkersImpl).toHaveBeenCalledTimes(1);
});

test("startup stops job workers and closes the server if worker start fails", async () => {
  const close = vi.fn();
  const app = {
    get: vi.fn(),
    use: vi.fn(),
    listen: vi.fn(() => ({ close, on: vi.fn() })),
  };
  const stopJobWorkersImpl = vi.fn(async () => undefined);

  await expect(
    createStartServer(app)({
      nodeEnv: "production",
      ensureTablesImpl: async () => undefined,
      existsSyncImpl: () => false,
      startJobWorkersImpl: async () => {
        throw new Error("worker_start_failed");
      },
      stopJobWorkersImpl,
    }),
  ).rejects.toThrow("worker_start_failed");

  expect(stopJobWorkersImpl).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

test("production startup serves static files, spa html, and api 404s when client dist exists", async () => {
  const app = createAppRecorder();
  const nextCalls = [];
  const assetStaticMiddleware = (_req, _res, next) => next();
  const staticMiddleware = (_req, _res, next) => next();
  const staticCalls = [];

  await createStartServer(app)({
    nodeEnv: "production",
    port: 0,
    clientDistPath: "/dist/client",
    ensureTablesImpl: async () => {},
    existsSyncImpl: (filePath) => filePath === "/dist/client",
    expressStaticImpl: (filePath, options) => {
      staticCalls.push({ filePath, options });
      return filePath.endsWith("/assets")
        ? assetStaticMiddleware
        : staticMiddleware;
    },
    readFileImpl: (async (filePath) => {
      expect(filePath).toBe("/dist/client/index.html");
      return "<html>";
    }) as unknown as typeof fs.promises.readFile,
    injectSharedCapsuleMetaTagsImpl: async (html, req) =>
      `${html}:meta:${req.path}`,
    isApiPathImpl: (requestPath) => requestPath.startsWith("/api"),
    logInfoImpl: () => {},
  });

  expect(staticCalls[0]).toEqual({
    filePath: "/dist/client/assets",
    options: {
      immutable: true,
      index: false,
      maxAge: 31_536_000_000,
    },
  });
  expect(staticCalls[1].filePath).toBe("/dist/client");
  expect(staticCalls[1].options.index).toBe(false);
  expect(typeof staticCalls[1].options.setHeaders).toBe("function");
  expect(app.calls[0]).toEqual({
    type: "use",
    args: ["/assets", assetStaticMiddleware],
  });
  expect(app.calls[1]).toEqual({ type: "use", args: [staticMiddleware] });
  expect(app.calls[2].type).toBe("get");
  expect(app.calls[2].args[0]).toBe("/{*splat}");

  const headerResponse = { setHeader: vi.fn() };
  staticCalls[1].options.setHeaders(headerResponse, "/dist/client/index.html");
  expect(headerResponse.setHeader).toHaveBeenCalledWith(
    "Cache-Control",
    "no-store",
  );

  const handler = app.calls[2].args[1];
  const rootResponse = createResponse();
  await handler({ path: "/", originalUrl: "/" }, rootResponse, (error) =>
    nextCalls.push(error),
  );
  expect(rootResponse.statusCode).toBe(302);
  expect(rootResponse.headers).toEqual({ Location: "/personal-items" });

  const rootQueryResponse = createResponse();
  await handler(
    { path: "/", originalUrl: "/?oauthReturnTo=%2Foauth%2Fauthorize" },
    rootQueryResponse,
    (error) => nextCalls.push(error),
  );
  expect(rootQueryResponse.statusCode).toBe(302);
  expect(rootQueryResponse.headers).toEqual({
    Location: "/personal-items?oauthReturnTo=%2Foauth%2Fauthorize",
  });

  const apiResponse = createResponse();
  await handler({ path: "/api/missing" }, apiResponse, (error) =>
    nextCalls.push(error),
  );
  expect(apiResponse.statusCode).toBe(404);
  expect(apiResponse.body).toEqual({ error: "not_found" });

  const pageResponse = createResponse();
  await handler({ path: "/share/abc" }, pageResponse, (error) =>
    nextCalls.push(error),
  );
  expect(pageResponse.statusCode).toBe(200);
  expect(pageResponse.headers).toEqual({
    "Cache-Control": "no-store",
    "Content-Type": "text/html",
  });
  expect(pageResponse.body).toBe("<html>:meta:/share/abc");
  expect(nextCalls).toEqual([]);
});

test("production startup forwards spa html read failures", async () => {
  const app = createAppRecorder();
  const thrown = new Error("missing index");
  const nextCalls = [];

  await createStartServer(app)({
    nodeEnv: "production",
    ensureTablesImpl: async () => {},
    existsSyncImpl: () => true,
    expressStaticImpl: () => (_req, _res, next) => next(),
    readFileImpl: async () => {
      throw thrown;
    },
    isApiPathImpl: () => false,
    logInfoImpl: () => {},
  });

  const handler = app.calls[2].args[1];
  await handler({ path: "/share/abc" }, createResponse(), (error) =>
    nextCalls.push(error),
  );

  expect(nextCalls).toEqual([thrown]);
});

test("production startup skips spa fallback when client dist is absent", async () => {
  const app = createAppRecorder();
  const ensureCalls = [];
  const logMessages = [];

  await createStartServer(app)({
    nodeEnv: "production",
    port: 5310,
    ensureTablesImpl: async () => {
      ensureCalls.push("ensure");
    },
    existsSyncImpl: () => false,
    logInfoImpl: (message) => logMessages.push(message),
  });

  expect(ensureCalls).toEqual(["ensure"]);
  expect(app.calls).toEqual([{ type: "listen", port: 5310 }]);
  expect(logMessages).toEqual(["Server listening on http://localhost:5310"]);
});
