import { EventEmitter } from "node:events";
import { expect, test, vi } from "vitest";
import {
  UPSTREAM_RESPONSE_BODY_LIMIT_BYTES,
  buildUpstreamUrl,
  createRenderApp,
  readLimitedResponseBody,
  sendPassthroughResponse,
  startRenderServer,
} from "./render-server.js";

class FakeResponse extends EventEmitter {
  chunks = [];
  destroyed = false;
  headers = {};
  statusCode = 200;
  writableEnded = false;
  writeResult = true;

  constructor({ writeResult = true } = {}) {
    super();
    this.writeResult = writeResult;
  }

  setHeader(key, value) {
    this.headers[key] = value;
  }

  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  }

  write(chunk) {
    this.chunks.push(Buffer.from(chunk));
    return this.writeResult;
  }

  end() {
    this.writableEnded = true;
    this.emit("finish");
    return this;
  }
}

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function waitForCondition(condition, message = "condition was not met") {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
}

test("buildUpstreamUrl keeps normal API paths on the configured upstream origin", () => {
  expect(buildUpstreamUrl({ originalUrl: "/api" }, "https://bff.example")).toBe(
    "https://bff.example/",
  );
  expect(
    buildUpstreamUrl({ originalUrl: "/api?x=1" }, "https://bff.example/base"),
  ).toBe("https://bff.example/?x=1");
  expect(
    buildUpstreamUrl({ originalUrl: "/api/auth?x=1" }, "https://bff.example"),
  ).toBe("https://bff.example/auth?x=1");
});

test("valid proxied requests call the configured upstream origin", async () => {
  const calls = [];
  const app = createRenderApp({
    upstreamOrigin: "https://bff.example",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new globalThis.Response("ok", {
        status: 201,
        headers: {
          "content-type": "text/plain",
          "x-upstream": "kept",
        },
      });
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await globalThis.fetch(`${baseUrl}/api/auth?x=1`);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-upstream")).toBe("kept");
    expect(await response.text()).toBe("ok");
  });

  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe("https://bff.example/auth?x=1");
  expect(calls[0].init.redirect).toBe("manual");
});

test("raw protocol-relative proxy paths are rejected before fetch", async () => {
  const calls = [];
  const app = createRenderApp({
    upstreamOrigin: "https://bff.example",
    fetchImpl: async (url) => {
      calls.push(url);
      return new globalThis.Response("unexpected");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await globalThis.fetch(
      `${baseUrl}/api//attacker.example/path`,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_proxy_path" });
  });

  expect(calls).toEqual([]);
});

test("encoded protocol-relative proxy paths are rejected before fetch", async () => {
  const calls = [];
  const app = createRenderApp({
    upstreamOrigin: "https://bff.example",
    fetchImpl: async (url) => {
      calls.push(url);
      return new globalThis.Response("unexpected");
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await globalThis.fetch(
      `${baseUrl}/api/%2F%2Fattacker.example/path`,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_proxy_path" });
  });

  expect(calls).toEqual([]);
});

test("oversized upstream responses fail before upstream headers are forwarded", async () => {
  const app = createRenderApp({
    upstreamOrigin: "https://bff.example",
    fetchImpl: async () =>
      new globalThis.Response("too large", {
        status: 200,
        headers: {
          "content-length": String(UPSTREAM_RESPONSE_BODY_LIMIT_BYTES + 1),
          "content-type": "text/plain",
          "x-upstream": "must-not-forward",
        },
      }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await globalThis.fetch(`${baseUrl}/api/auth`);
    expect(response.status).toBe(502);
    expect(response.headers.get("x-upstream")).toBeNull();
    expect(await response.json()).toEqual({
      error: "upstream_response_too_large",
    });
  });
});

test.each([
  {
    headers: { "content-type": "application/pdf" },
    path: "/api/capsules/capsule-1/pdf",
  },
  {
    headers: { "content-type": "text/event-stream" },
    path: "/api/jobs/job-1/events",
  },
  {
    headers: { "content-disposition": "attachment; filename=report.csv" },
    path: "/api/export",
  },
])(
  "streamable upstream responses bypass the buffered proxy cap",
  async (caseInput) => {
    const app = createRenderApp({
      upstreamOrigin: "https://bff.example",
      fetchImpl: async () =>
        new globalThis.Response("streamed body", {
          status: 200,
          headers: {
            "content-length": String(UPSTREAM_RESPONSE_BODY_LIMIT_BYTES + 1),
            "x-upstream": "kept",
            ...caseInput.headers,
          },
        }),
    });

    await withServer(app, async (baseUrl) => {
      const response = await globalThis.fetch(`${baseUrl}${caseInput.path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-upstream")).toBe("kept");
      expect(await response.text()).toBe("streamed body");
    });
  },
);

test("passthrough streaming aborts upstream when the client disconnects", async () => {
  let upstreamSignal = null;
  let upstreamCancelled = false;
  const app = createRenderApp({
    upstreamOrigin: "https://bff.example",
    fetchImpl: async (_url, init) => {
      upstreamSignal = init.signal;
      return new globalThis.Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data: first\n\n"));
          },
          cancel() {
            upstreamCancelled = true;
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
          },
        },
      );
    },
  });

  await withServer(app, async (baseUrl) => {
    const abortController = new AbortController();
    const response = await globalThis.fetch(
      `${baseUrl}/api/jobs/job-1/events`,
      {
        signal: abortController.signal,
      },
    );
    const reader = response.body.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe("data: first\n\n");

    abortController.abort();
    await waitForCondition(
      () => upstreamSignal?.aborted || upstreamCancelled,
      "upstream stream was not aborted after client disconnect",
    );
  });
});

test("sendPassthroughResponse waits for drain under downstream backpressure", async () => {
  const res = new FakeResponse({ writeResult: false });
  const sent = sendPassthroughResponse(
    new globalThis.Response("streamed", {
      status: 202,
      headers: { "x-stream": "yes" },
    }),
    res,
  );

  await waitForCondition(() => res.chunks.length === 1);
  expect(res.statusCode).toBe(202);
  expect(res.headers["x-stream"]).toBe("yes");
  expect(Buffer.concat(res.chunks).toString("utf8")).toBe("streamed");

  res.emit("drain");
  await sent;
  expect(res.writableEnded).toBe(true);
});

test("sendPassthroughResponse rejects when downstream closes during backpressure", async () => {
  const res = new FakeResponse({ writeResult: false });
  const sent = sendPassthroughResponse(
    new globalThis.Response("streamed", {
      headers: { "content-type": "text/event-stream" },
    }),
    res,
  );

  await waitForCondition(() => res.chunks.length === 1);
  res.destroyed = true;
  res.emit("close");

  await expect(sent).rejects.toThrow("Downstream response closed");
});

test("readLimitedResponseBody enforces streamed byte limits without content-length", async () => {
  await expect(
    readLimitedResponseBody(new globalThis.Response("too large"), 3),
  ).rejects.toThrow("Upstream response exceeds proxy limit");

  await expect(
    readLimitedResponseBody(
      new globalThis.Response("ok", {
        headers: { "content-length": "not-a-number" },
      }),
      3,
    ),
  ).resolves.toEqual(Buffer.from("ok"));
});

test("startRenderServer creates a listening server", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const server = startRenderServer({
    port: 0,
    upstreamOrigin: "https://bff.example",
  });

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    expect(server.listening).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/listening on :0$/));
  } finally {
    log.mockRestore();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
