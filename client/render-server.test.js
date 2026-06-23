import { expect, test, vi } from "vitest";
import {
  UPSTREAM_RESPONSE_BODY_LIMIT_BYTES,
  buildUpstreamUrl,
  createRenderApp,
  readLimitedResponseBody,
  startRenderServer,
} from "./render-server.js";

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
