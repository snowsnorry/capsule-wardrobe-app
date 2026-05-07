import { test, expect } from "vitest";
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
  expect(app.calls[0].type).toBe("use");
  expect(app.calls[0].args[0]).toBe("vite-middleware");
  expect(app.calls[1].type).toBe("use");
  expect(app.calls[1].args[0]).toBe("*");
  expect(app.calls.at(-1)).toEqual({ type: "listen", port: 4123 });
  expect(logMessages).toEqual(["Server listening on http://localhost:4123"]);

  const handler = app.calls[1].args[1];
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

  const handler = app.calls[1].args[1];
  await handler(
    { path: "/share/abc", originalUrl: "/share/abc" },
    createResponse(),
    (error) => nextCalls.push(error),
  );

  expect(fixedErrors).toEqual([thrown]);
  expect(nextCalls).toEqual([thrown]);
});

test("production startup serves static files, spa html, and api 404s when client dist exists", async () => {
  const app = createAppRecorder();
  const nextCalls = [];
  const staticMiddleware = (_req, _res, next) => next();

  await createStartServer(app)({
    nodeEnv: "production",
    port: 0,
    clientDistPath: "/dist/client",
    ensureTablesImpl: async () => {},
    existsSyncImpl: (filePath) => filePath === "/dist/client",
    expressStaticImpl: (filePath) => {
      expect(filePath).toBe("/dist/client");
      return staticMiddleware;
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

  expect(app.calls[0]).toEqual({ type: "use", args: [staticMiddleware] });
  expect(app.calls[1].type).toBe("get");
  expect(app.calls[1].args[0]).toBe("*");

  const handler = app.calls[1].args[1];
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
  expect(pageResponse.headers).toEqual({ "Content-Type": "text/html" });
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

  const handler = app.calls[1].args[1];
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
