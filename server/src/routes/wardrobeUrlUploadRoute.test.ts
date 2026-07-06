import { expect, test, vi } from "vitest";
import { registerWardrobeUrlUploadRoute } from "./wardrobeUrlUploadRoute.js";

function createFakeApp() {
  const routes = new Map<string, Array<(...args: unknown[]) => unknown>>();
  return {
    post(path: string, ...handlers: Array<(...args: unknown[]) => unknown>) {
      routes.set(path, handlers);
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

async function invoke(app: ReturnType<typeof createFakeApp>, body: unknown) {
  const handlers = app.routes.get("/wardrobe/items/upload-url");
  if (!handlers) throw new Error("route not registered");
  const req = { body, user: { email: "person@example.com" } };
  const res = createResponse();
  let index = 0;
  const next = async (): Promise<void> => {
    const handler = handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return res;
}

function createContext(overrides = {}) {
  return {
    enqueueJobImpl: vi.fn(async () => ({
      id: "job-1",
      kind: "personalItemUploadUrls",
      status: "queued",
      entity: { type: "wardrobe", id: null },
    })),
    requireAuth: (_req, _res, next) => next(),
    requireCsrf: (_req, _res, next) => next(),
    requireTrustedOrigin: (_req, _res, next) => next(),
    uploadEnqueueLimiter: (_req, _res, next) => next(),
    ...overrides,
  };
}

test("upload-url route validates URLs before enqueueing", async () => {
  const app = createFakeApp();
  const context = createContext();
  registerWardrobeUrlUploadRoute(app, context);

  const invalid = await invoke(app, { urls: ["not-a-url"] });

  expect(invalid.statusCode).toBe(400);
  expect(invalid.body).toEqual({ error: "invalid_payload" });
  expect(context.enqueueJobImpl).not.toHaveBeenCalled();
});

test("upload-url route enqueues normalized URL jobs and maps queue failures", async () => {
  const app = createFakeApp();
  const context = createContext();
  registerWardrobeUrlUploadRoute(app, context);

  const queued = await invoke(app, {
    urls: [" https://example.com/a.png ", "https://example.com/a.png"],
  });
  expect(queued.statusCode).toBe(202);
  expect(context.enqueueJobImpl).toHaveBeenCalledWith(
    expect.objectContaining({
      dedupeKey:
        "personalItemUploadUrls:https://example.com/a.png|https://example.com/a.png",
      payload: {
        urls: ["https://example.com/a.png", "https://example.com/a.png"],
      },
      progressTotal: 2,
    }),
  );

  context.enqueueJobImpl.mockRejectedValueOnce(new Error("queue_down"));
  const failed = await invoke(app, { urls: ["https://example.com/b.png"] });
  expect(failed.statusCode).toBe(503);
  expect(failed.body).toEqual({ error: "service_unavailable" });

  context.enqueueJobImpl.mockRejectedValueOnce(
    Object.assign(new Error("too_many_active_jobs"), {
      code: "too_many_active_jobs",
    }),
  );
  const capped = await invoke(app, { urls: ["https://example.com/c.png"] });
  expect(capped.statusCode).toBe(429);
  expect(capped.body).toEqual({ error: "too_many_active_jobs" });
});
