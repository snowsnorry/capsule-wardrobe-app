import { expect, test, vi } from "vitest";
import { registerOutfitMediaRoutes } from "./outfitMediaRoutes.js";

function createFakeApp() {
  const routes = new Map<string, Array<(...args: unknown[]) => unknown>>();
  const register = (
    method: string,
    path: string,
    handlers: Array<(...args: unknown[]) => unknown>,
  ) => {
    routes.set(`${method} ${path}`, handlers);
  };
  return {
    delete(path: string, ...handlers: Array<(...args: unknown[]) => unknown>) {
      register("DELETE", path, handlers);
    },
    post(path: string, ...handlers: Array<(...args: unknown[]) => unknown>) {
      register("POST", path, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    body: undefined as unknown,
    statusCode: 200,
    json: vi.fn(function json(
      this: ReturnType<typeof createResponse>,
      body: unknown,
    ) {
      this.body = body;
      return this;
    }),
    status: vi.fn(function status(
      this: ReturnType<typeof createResponse>,
      statusCode: number,
    ) {
      this.statusCode = statusCode;
      return this;
    }),
  };
}

async function invokeReportPost({
  app,
  id = "outfit-1",
}: {
  app: ReturnType<typeof createFakeApp>;
  id?: string;
}) {
  const handlers = app.routes.get("POST /outfits/:id/report");
  if (!handlers) throw new Error("route not registered");
  const req = {
    params: { id },
    user: { email: "person@example.com" },
  };
  const res = createResponse();
  let index = 0;
  const next = async (): Promise<void> => {
    const handler = handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return res;
}

function passthrough(_req: unknown, _res: unknown, next: () => unknown) {
  return next();
}

function createContext(overrides = {}) {
  return {
    deleteOutfitImageHandler: vi.fn(),
    generateOutfitImageHandler: vi.fn(),
    getOutfitImpl: vi.fn(async () => ({ id: "outfit-1" })),
    requireAuth: passthrough,
    requireCsrf: passthrough,
    requireTrustedOrigin: passthrough,
    updateOutfitReportImpl: vi.fn(),
    ...overrides,
  };
}

test("outfit report route returns not_found before enqueue when the outfit is missing", async () => {
  const app = createFakeApp();
  const context = createContext({
    getOutfitImpl: vi.fn(async () => null),
  });
  registerOutfitMediaRoutes(app, context);

  const res = await invokeReportPost({ app, id: "missing" });

  expect(res.statusCode).toBe(404);
  expect(res.body).toEqual({ error: "not_found" });
});

test("outfit report route maps enqueue validation errors and service failures", async () => {
  const app = createFakeApp();
  const enqueueJobImpl = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error("invalid_payload"), { code: "invalid_payload" }),
    )
    .mockRejectedValueOnce(new Error("queue_down"));
  const context = createContext({ enqueueJobImpl });
  registerOutfitMediaRoutes(app, context);

  const invalid = await invokeReportPost({ app });
  expect(invalid.statusCode).toBe(400);
  expect(invalid.body).toEqual({ error: "invalid_payload" });

  const failed = await invokeReportPost({ app });
  expect(failed.statusCode).toBe(503);
  expect(failed.body).toEqual({ error: "service_unavailable" });
});
