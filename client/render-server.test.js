import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UPSTREAM_RESPONSE_BODY_LIMIT_BYTES,
  buildUpstreamUrl,
  createRenderApp,
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
  assert.equal(
    buildUpstreamUrl({ originalUrl: "/api" }, "https://bff.example"),
    "https://bff.example/",
  );
  assert.equal(
    buildUpstreamUrl({ originalUrl: "/api?x=1" }, "https://bff.example/base"),
    "https://bff.example/?x=1",
  );
  assert.equal(
    buildUpstreamUrl({ originalUrl: "/api/auth?x=1" }, "https://bff.example"),
    "https://bff.example/auth?x=1",
  );
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
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("x-upstream"), "kept");
    assert.equal(await response.text(), "ok");
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://bff.example/auth?x=1");
  assert.equal(calls[0].init.redirect, "manual");
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
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_proxy_path" });
  });

  assert.deepEqual(calls, []);
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
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_proxy_path" });
  });

  assert.deepEqual(calls, []);
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
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("x-upstream"), null);
    assert.deepEqual(await response.json(), {
      error: "upstream_response_too_large",
    });
  });
});
