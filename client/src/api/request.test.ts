import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearRequestCache,
  getCachedJson,
  request,
  requestJson,
} from "./request";

type HeaderMap = Record<string, string>;
type ResponseLike = Pick<Response, "ok" | "status" | "text"> & {
  headers: Pick<Headers, "get">;
};

function createResponse({
  ok = true,
  status = 200,
  headers = {},
  body = "",
}: {
  body?: string;
  headers?: HeaderMap;
  ok?: boolean;
  status?: number;
} = {}): ResponseLike {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? headers[name] ?? null;
      },
    },
    async text() {
      return body;
    },
  };
}

describe("request api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearRequestCache();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(document, "cookie", {
      configurable: true,
      value: "csrf=token-123; theme=light",
    });
  });

  afterEach(() => {
    clearRequestCache();
  });

  test("request injects csrf header for state-changing methods", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(createResponse() as Response);

    await request("/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("PATCH");
    const headers = options.headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  test("requestJson parses json bodies and returns empty object for empty success payloads", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createResponse({
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ ok: true, items: [1, 2] }),
        }) as Response,
      )
      .mockResolvedValueOnce(
        createResponse({
          headers: { "content-type": "application/json" },
          body: "",
        }) as Response,
      );

    await expect(requestJson("/api/one")).resolves.toEqual({
      ok: true,
      items: [1, 2],
    });
    await expect(requestJson("/api/two")).resolves.toEqual({});
  });

  test("requestJson uses non-json fallback payloads for error messages", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createResponse({
        ok: false,
        status: 502,
        headers: { "content-type": "text/plain" },
        body: "gateway_down",
      }) as Response,
    );

    await expect(requestJson("/api/fail")).rejects.toMatchObject({
      message: "request_failed_502",
      status: 502,
      data: { raw: "gateway_down" },
    });
  });

  test("getCachedJson dedupes in-flight requests and serves cached value until cleared", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = getCachedJson("/profile/status", { ttlMs: 1000 });
    const second = getCachedJson("/profile/status", { ttlMs: 1000 });

    expect(fetch).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      createResponse({
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hasProfile: true }),
      }) as Response,
    );

    await expect(first).resolves.toEqual({ hasProfile: true });
    await expect(second).resolves.toEqual({ hasProfile: true });

    const third = await getCachedJson("/profile/status", { ttlMs: 1000 });
    expect(third).toEqual({ hasProfile: true });
    expect(fetch).toHaveBeenCalledTimes(1);

    clearRequestCache();
    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hasProfile: false }),
      }) as Response,
    );

    await expect(
      getCachedJson("/profile/status", { ttlMs: 1000 }),
    ).resolves.toEqual({ hasProfile: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
