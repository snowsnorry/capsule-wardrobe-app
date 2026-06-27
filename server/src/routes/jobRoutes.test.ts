import { expect, test, vi } from "vitest";
import { registerJobRoutes } from "./jobRoutes.js";

function createJob(overrides = {}) {
  return {
    id: "job-1",
    kind: "capsuleGenerate",
    status: "queued",
    phase: "queued",
    progress: { current: 0, total: null, label: null },
    entity: { type: "capsule", id: "capsule-1" },
    result: null,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    ...overrides,
  };
}

function createFakeApp() {
  const routes = new Map<string, Array<(...args: unknown[]) => unknown>>();
  return {
    get(path: string, ...handlers: Array<(...args: unknown[]) => unknown>) {
      routes.set(path, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    body: undefined as unknown,
    destroyed: false,
    headers: new Map<string, string>(),
    headersSent: false,
    statusCode: 200,
    writableEnded: false,
    chunks: [] as string[],
    end: vi.fn(function end(this: ReturnType<typeof createResponse>) {
      this.writableEnded = true;
      return this;
    }),
    flushHeaders: vi.fn(function flushHeaders(
      this: ReturnType<typeof createResponse>,
    ) {
      this.headersSent = true;
      return this;
    }),
    json: vi.fn(function json(
      this: ReturnType<typeof createResponse>,
      body: unknown,
    ) {
      this.body = body;
      this.headersSent = true;
      this.writableEnded = true;
      return this;
    }),
    setHeader: vi.fn(function setHeader(
      this: ReturnType<typeof createResponse>,
      name: string,
      value: string,
    ) {
      this.headers.set(name.toLowerCase(), value);
      return this;
    }),
    status: vi.fn(function status(
      this: ReturnType<typeof createResponse>,
      statusCode: number,
    ) {
      this.statusCode = statusCode;
      return this;
    }),
    write: vi.fn(function write(
      this: ReturnType<typeof createResponse>,
      chunk: string,
    ) {
      this.chunks.push(chunk);
      return true;
    }),
  };
}

async function invokeRoute({
  app,
  path,
  req,
}: {
  app: ReturnType<typeof createFakeApp>;
  path: string;
  req: Record<string, unknown>;
}) {
  const handlers = app.routes.get(path);
  if (!handlers) {
    throw new Error(`route not registered: ${path}`);
  }
  const res = createResponse();
  let index = 0;
  const next = async (): Promise<void> => {
    const handler = handlers[index++];
    if (!handler) return;
    await handler(req, res, next);
  };
  await next();
  return res;
}

function createContext(overrides = {}) {
  return {
    getJobSnapshotImpl: vi.fn(async () => createJob()),
    listJobEventsAfterImpl: vi.fn(async () => []),
    listJobSnapshotsImpl: vi.fn(async () => [createJob()]),
    requireAuth: (_req, _res, next) => next(),
    ...overrides,
  };
}

test("GET /jobs lists authenticated jobs with normalized status filters", async () => {
  const app = createFakeApp();
  const context = createContext();
  registerJobRoutes(app, context);

  const res = await invokeRoute({
    app,
    path: "/jobs",
    req: {
      query: { status: "active" },
      user: { email: "person@example.com" },
    },
  });

  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ ok: true, jobs: [createJob()] });
  expect(context.listJobSnapshotsImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    status: "active",
  });

  await invokeRoute({
    app,
    path: "/jobs",
    req: {
      query: { status: ["failed"] },
      user: { email: "person@example.com" },
    },
  });
  expect(context.listJobSnapshotsImpl).toHaveBeenLastCalledWith({
    email: "person@example.com",
    status: "failed",
  });
});

test("GET /jobs/:jobId enforces ownership through context lookup", async () => {
  const app = createFakeApp();
  const context = createContext({
    getJobSnapshotImpl: vi.fn(async () => null),
  });
  registerJobRoutes(app, context);

  const res = await invokeRoute({
    app,
    path: "/jobs/:jobId",
    req: {
      params: { jobId: "missing" },
      user: { email: "person@example.com" },
    },
  });

  expect(res.statusCode).toBe(404);
  expect(res.body).toEqual({ error: "not_found" });
  expect(context.getJobSnapshotImpl).toHaveBeenCalledWith({
    id: "missing",
    email: "person@example.com",
  });

  context.getJobSnapshotImpl.mockResolvedValueOnce(createJob());
  const found = await invokeRoute({
    app,
    path: "/jobs/:jobId",
    req: {
      params: { jobId: "job-1" },
      user: { email: "person@example.com" },
    },
  });
  expect(found.body).toEqual({ ok: true, job: createJob() });
});

test("GET /jobs/:jobId/events sends initial snapshot and replayed terminal events", async () => {
  const app = createFakeApp();
  const completed = createJob({
    status: "completed",
    completedAt: "2026-01-01T00:01:00.000Z",
  });
  const context = createContext({
    getJobSnapshotImpl: vi.fn(async () => createJob({ status: "running" })),
    listJobEventsAfterImpl: vi.fn(async () => [
      {
        id: 4,
        jobId: "job-1",
        eventType: "complete",
        data: { job: completed },
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ]),
  });
  registerJobRoutes(app, context);

  const res = await invokeRoute({
    app,
    path: "/jobs/:jobId/events",
    req: {
      headers: { "last-event-id": "3" },
      params: { jobId: "job-1" },
      user: { email: "person@example.com" },
    },
  });

  expect(res.statusCode).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/event-stream");
  expect(res.flushHeaders).toHaveBeenCalledTimes(1);
  expect(res.end).toHaveBeenCalledTimes(1);
  expect(res.chunks.join("")).toContain("event: snapshot");
  expect(res.chunks.join("")).toContain("id: 4");
  expect(res.chunks.join("")).toContain("event: complete");
  expect(context.listJobEventsAfterImpl).toHaveBeenCalledWith({
    jobId: "job-1",
    afterId: 3,
  });
});

test("job routes map service failures to service_unavailable without leaking details", async () => {
  const app = createFakeApp();
  const context = createContext({
    listJobSnapshotsImpl: vi.fn(async () => {
      throw new Error("db_down");
    }),
  });
  registerJobRoutes(app, context);

  const res = await invokeRoute({
    app,
    path: "/jobs",
    req: {
      query: { status: "unexpected" },
      user: { email: "person@example.com" },
    },
  });

  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: "service_unavailable" });
  expect(context.listJobSnapshotsImpl).toHaveBeenCalledWith({
    email: "person@example.com",
    status: null,
  });
});

test("GET /jobs/:jobId/events maps missing jobs and stream failures", async () => {
  const app = createFakeApp();
  const context = createContext({
    getJobSnapshotImpl: vi.fn(async () => null),
  });
  registerJobRoutes(app, context);

  const missing = await invokeRoute({
    app,
    path: "/jobs/:jobId/events",
    req: {
      headers: {},
      params: { jobId: "missing" },
      user: { email: "person@example.com" },
    },
  });
  expect(missing.statusCode).toBe(404);
  expect(missing.body).toEqual({ error: "not_found" });

  context.getJobSnapshotImpl.mockResolvedValueOnce(createJob());
  context.listJobEventsAfterImpl = vi.fn(async () => {
    throw new Error("db_down");
  });
  const failed = await invokeRoute({
    app,
    path: "/jobs/:jobId/events",
    req: {
      headers: {},
      params: { jobId: "job-1" },
      user: { email: "person@example.com" },
    },
  });
  expect(failed.chunks.join("")).toContain("event: failed");
  expect(failed.end).toHaveBeenCalledTimes(1);
});
