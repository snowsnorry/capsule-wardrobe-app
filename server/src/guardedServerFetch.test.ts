import { EventEmitter } from "node:events";
import http from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import { guardedServerFetchBuffer } from "./guardedServerFetch.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function publicLookup(address = "93.184.216.34") {
  return vi.fn(async () => [{ address, family: 4 }]);
}

test("guarded server fetch rejects unsafe URLs and DNS answers before requests", async () => {
  const requestImpl = vi.fn();

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      maxBytes: 10,
      requestImpl,
      timeoutMs: 1000,
      url: "not a url",
    }),
  ).rejects.toThrow("unsafe_server_fetch_url");

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup("10.0.0.1"),
      maxBytes: 10,
      requestImpl,
      timeoutMs: 1000,
      url: "https://cdn.example.com/image.png",
    }),
  ).rejects.toThrow("unsafe_server_fetch_dns");
  expect(requestImpl).not.toHaveBeenCalled();
});

test("guarded server fetch follows safe redirects and caps redirect chains", async () => {
  const lookupImpl = publicLookup();
  const requestImpl = vi
    .fn()
    .mockResolvedValueOnce({
      headers: new Headers({ location: "/next.png" }),
      location: "/next.png",
      redirect: true as const,
      status: 302,
    })
    .mockResolvedValueOnce({
      buffer: Buffer.from("image"),
      headers: new Headers({ "content-type": "image/png" }),
      redirect: false as const,
      status: 200,
    });

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl,
      maxBytes: 10,
      requestImpl,
      timeoutMs: 1000,
      url: "https://cdn.example.com/start.png",
    }),
  ).resolves.toMatchObject({
    buffer: Buffer.from("image"),
    status: 200,
    url: "https://cdn.example.com/next.png",
  });

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      maxRedirects: 0,
      requestImpl: vi.fn(async () => ({
        headers: new Headers({ location: "/again.png" }),
        location: "/again.png",
        redirect: true as const,
        status: 302,
      })),
      timeoutMs: 1000,
      url: "https://cdn.example.com/start.png",
    }),
  ).rejects.toThrow("server_fetch_too_many_redirects");
});

test("guarded server fetch rejects malformed redirect responses", async () => {
  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      requestImpl: vi.fn(async () => ({
        headers: new Headers({ location: "/not-really-redirect.png" }),
        location: "/not-really-redirect.png",
        redirect: true as const,
        status: 200,
      })),
      timeoutMs: 1000,
      url: "https://cdn.example.com/start.png",
    }),
  ).rejects.toThrow("server_fetch_failed_200");

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      requestImpl: vi.fn(async () => ({
        headers: new Headers({ location: "ftp://files.example.com/image.png" }),
        location: "ftp://files.example.com/image.png",
        redirect: true as const,
        status: 302,
      })),
      timeoutMs: 1000,
      url: "https://cdn.example.com/start.png",
    }),
  ).rejects.toThrow("unsafe_server_fetch_redirect");
});

test("guarded server fetch node request wrapper buffers responses", async () => {
  const pinnedAddresses: Array<{ address: string; family: number }> = [];
  vi.spyOn(http, "request").mockImplementation(((url, options, callback) => {
    const request = new EventEmitter() as http.ClientRequest;
    const response = new EventEmitter() as http.IncomingMessage;
    response.statusCode = 200;
    response.headers = {
      "content-type": "text/plain",
      "set-cookie": ["a=1", "b=2"],
      "x-empty": undefined,
    };
    request.destroy = vi.fn((error?: Error) => {
      if (error) {
        request.emit("error", error);
      }
      return request;
    }) as http.ClientRequest["destroy"];
    request.end = vi.fn(() => {
      expect(url).toEqual(new URL("http://cdn.example.com/image.txt"));
      (
        options as http.RequestOptions & {
          lookup: (
            hostname: string,
            options: unknown,
            callback: (
              error: Error | null,
              address: string,
              family: number,
            ) => void,
          ) => void;
        }
      ).lookup("cdn.example.com", {}, (error, address, family) => {
        expect(error).toBeNull();
        pinnedAddresses.push({ address: String(address), family });
      });
      callback?.(response);
      setImmediate(() => {
        response.emit("data", "hello ");
        response.emit("data", Buffer.from("world"));
        response.emit("end");
      });
      return request;
    }) as http.ClientRequest["end"];
    return request;
  }) as typeof http.request);

  const result = await guardedServerFetchBuffer({
    errorCode: "image_url_too_large",
    lookupImpl: publicLookup("93.184.216.34"),
    maxBytes: 20,
    timeoutMs: 1000,
    url: "http://cdn.example.com/image.txt",
  });

  expect(result.buffer).toEqual(Buffer.from("hello world"));
  expect(result.headers.get("content-type")).toBe("text/plain");
  expect(pinnedAddresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
});

test("guarded server fetch node request wrapper handles redirects, byte caps, and timeouts", async () => {
  vi.spyOn(http, "request").mockImplementationOnce(((
    _url,
    _options,
    callback,
  ) => {
    const request = new EventEmitter() as http.ClientRequest;
    const response = new EventEmitter() as http.IncomingMessage;
    response.statusCode = 302;
    response.headers = { location: "https://cdn.example.com/next.png" };
    response.resume = vi.fn() as http.IncomingMessage["resume"];
    request.destroy = vi.fn() as http.ClientRequest["destroy"];
    request.end = vi.fn(() => {
      callback?.(response);
      return request;
    }) as http.ClientRequest["end"];
    return request;
  }) as typeof http.request);

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      maxRedirects: 0,
      timeoutMs: 1000,
      url: "http://cdn.example.com/start.png",
    }),
  ).rejects.toThrow("server_fetch_too_many_redirects");

  vi.restoreAllMocks();
  vi.spyOn(http, "request").mockImplementationOnce(((
    _url,
    _options,
    callback,
  ) => {
    const request = new EventEmitter() as http.ClientRequest;
    const response = new EventEmitter() as http.IncomingMessage;
    response.statusCode = 200;
    response.headers = {};
    request.destroy = vi.fn((error?: Error) => {
      if (error) {
        request.emit("error", error);
      }
      return request;
    }) as http.ClientRequest["destroy"];
    request.end = vi.fn(() => {
      callback?.(response);
      setImmediate(() => response.emit("data", Buffer.from("too large")));
      return request;
    }) as http.ClientRequest["end"];
    return request;
  }) as typeof http.request);

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 3,
      timeoutMs: 1000,
      url: "http://cdn.example.com/large.png",
    }),
  ).rejects.toThrow("image_url_too_large");

  vi.restoreAllMocks();
  vi.spyOn(http, "request").mockImplementationOnce((() => {
    const request = new EventEmitter() as http.ClientRequest;
    request.destroy = vi.fn((error?: Error) => {
      if (error) {
        request.emit("error", error);
      }
      return request;
    }) as http.ClientRequest["destroy"];
    request.end = vi.fn(() => {
      request.emit("timeout");
      return request;
    }) as http.ClientRequest["end"];
    return request;
  }) as typeof http.request);

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      timeoutMs: 1000,
      url: "http://cdn.example.com/timeout.png",
    }),
  ).rejects.toThrow("server_fetch_timeout");
});

test("guarded server fetch rejects over-limit content-length before buffering", async () => {
  let emittedData = false;
  vi.spyOn(http, "request").mockImplementationOnce(((
    _url,
    _options,
    callback,
  ) => {
    const request = new EventEmitter() as http.ClientRequest;
    const response = new EventEmitter() as http.IncomingMessage;
    response.statusCode = 200;
    response.headers = { "content-length": "11" };
    response.resume = vi.fn() as http.IncomingMessage["resume"];
    request.destroy = vi.fn((error?: Error) => {
      if (error) {
        request.emit("error", error);
      }
      return request;
    }) as http.ClientRequest["destroy"];
    request.end = vi.fn(() => {
      callback?.(response);
      setImmediate(() => {
        emittedData = true;
        response.emit("data", Buffer.from("too large"));
        response.emit("end");
      });
      return request;
    }) as http.ClientRequest["end"];
    return request;
  }) as typeof http.request);

  await expect(
    guardedServerFetchBuffer({
      errorCode: "image_url_too_large",
      lookupImpl: publicLookup(),
      maxBytes: 10,
      timeoutMs: 1000,
      url: "http://cdn.example.com/large.png",
    }),
  ).rejects.toThrow("image_url_too_large");
  expect(emittedData).toBe(false);
});
