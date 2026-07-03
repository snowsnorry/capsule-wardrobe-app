import { expect, test, vi } from "vitest";
import {
  SEARCH_PRODUCT_OPTIONS_CHANNEL,
  createSearchCacheInvalidationService,
  type SearchCacheListenerClient,
} from "./searchCacheInvalidation.js";

function createFakeClient() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const client = {
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
      return client;
    }),
    query: vi.fn(async () => undefined),
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.(...args);
    },
  };
  return client as SearchCacheListenerClient & {
    connect: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => void;
    end: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

test("search cache invalidation listens for product catalog notifications", async () => {
  const client = createFakeClient();
  const markStale = vi.fn();
  const logErrorImpl = vi.fn();
  const logInfoImpl = vi.fn();
  const clearIntervalImpl = vi.fn();
  let intervalCallback: (() => void) | null = null;
  const interval = { unref: vi.fn() } as unknown as NodeJS.Timeout;
  const service = createSearchCacheInvalidationService({
    clearIntervalImpl,
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    logErrorImpl,
    logInfoImpl,
    markStale,
    setIntervalImpl: ((callback) => {
      intervalCallback = callback as () => void;
      return interval;
    }) as typeof setInterval,
  });

  await service.start();
  expect(markStale).toHaveBeenCalledTimes(1);
  expect(client.connect).toHaveBeenCalledTimes(1);
  expect(client.query).toHaveBeenCalledWith(
    `LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`,
  );
  expect(interval.unref).toHaveBeenCalledTimes(1);

  client.emit("notification", { channel: SEARCH_PRODUCT_OPTIONS_CHANNEL });
  intervalCallback?.();
  expect(markStale).toHaveBeenCalledTimes(3);

  client.emit("notification", { channel: "other_channel" });
  expect(markStale).toHaveBeenCalledTimes(3);
  const error = new Error("listener_error");
  client.emit("error", error);
  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation]",
    error,
  );

  await service.stop();
  expect(clearIntervalImpl).toHaveBeenCalledWith(interval);
  expect(client.end).toHaveBeenCalledTimes(1);
});

test("search cache invalidation logs listener end events", async () => {
  const client = createFakeClient();
  const logInfoImpl = vi.fn();
  const service = createSearchCacheInvalidationService({
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logInfoImpl,
    markStale: vi.fn(),
  });

  await service.start();
  client.emit("end");
  await service.stop();

  expect(logInfoImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation] listener ended",
  );
  expect(client.end).not.toHaveBeenCalled();
});

test("search cache invalidation logs listener startup failures without throwing", async () => {
  const client = createFakeClient();
  const error = new Error("connect_failed");
  client.connect.mockRejectedValueOnce(error);
  const logErrorImpl = vi.fn();
  const service = createSearchCacheInvalidationService({
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logErrorImpl,
    markStale: vi.fn(),
  });

  await expect(service.start()).resolves.toBeUndefined();
  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation]",
    error,
  );
  expect(client.end).toHaveBeenCalledTimes(1);
});

test("search cache invalidation logs listener cleanup failures", async () => {
  const client = createFakeClient();
  const error = new Error("end_failed");
  client.end.mockRejectedValue(error);
  const logErrorImpl = vi.fn();
  const service = createSearchCacheInvalidationService({
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logErrorImpl,
    markStale: vi.fn(),
  });

  await service.start();
  await service.stop();

  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation][stop]",
    error,
  );
});

test("search cache invalidation logs cleanup failure after startup failure", async () => {
  const client = createFakeClient();
  const connectError = new Error("connect_failed");
  const endError = new Error("end_failed");
  client.connect.mockRejectedValueOnce(connectError);
  client.end.mockRejectedValueOnce(endError);
  const logErrorImpl = vi.fn();
  const service = createSearchCacheInvalidationService({
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logErrorImpl,
    markStale: vi.fn(),
  });

  await service.start();

  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation]",
    connectError,
  );
  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation][stop]",
    endError,
  );
});
