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

function createTimeoutControls() {
  const callbacks: Array<() => void> = [];
  const timeouts: Array<NodeJS.Timeout & { unref: ReturnType<typeof vi.fn> }> =
    [];
  const setTimeoutImpl = vi.fn((callback: () => void, _delay?: number) => {
    const timeout = { unref: vi.fn() } as unknown as NodeJS.Timeout & {
      unref: ReturnType<typeof vi.fn>;
    };
    callbacks.push(callback);
    timeouts.push(timeout);
    return timeout;
  });
  return {
    callbacks,
    clearTimeoutImpl: vi.fn(),
    setTimeoutImpl,
    timeouts,
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
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    clearTimeoutImpl:
      timeoutControls.clearTimeoutImpl as unknown as typeof clearTimeout,
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logInfoImpl,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
  });

  await service.start();
  client.emit("end");
  await service.stop();

  expect(logInfoImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation] listener ended",
  );
  expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledWith(
    expect.any(Function),
    1000,
  );
  expect(timeoutControls.clearTimeoutImpl).toHaveBeenCalledWith(
    timeoutControls.timeouts[0],
  );
  expect(client.end).not.toHaveBeenCalled();
});

test("search cache invalidation reconnects after listener end events", async () => {
  const firstClient = createFakeClient();
  const secondClient = createFakeClient();
  const createClientImpl = vi
    .fn()
    .mockReturnValueOnce(firstClient)
    .mockReturnValueOnce(secondClient);
  const logInfoImpl = vi.fn();
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    createClientImpl,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logInfoImpl,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
  });

  await service.start();
  firstClient.emit("end");

  expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledWith(
    expect.any(Function),
    1000,
  );
  expect(timeoutControls.timeouts[0]?.unref).toHaveBeenCalledTimes(1);

  timeoutControls.callbacks[0]?.();
  await vi.waitFor(() => {
    expect(secondClient.connect).toHaveBeenCalledTimes(1);
    expect(secondClient.query).toHaveBeenCalledWith(
      `LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`,
    );
  });

  firstClient.emit("end");
  expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledTimes(1);
  expect(logInfoImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation] listener reconnected",
  );

  await service.stop();
  expect(secondClient.end).toHaveBeenCalledTimes(1);
});

test("search cache invalidation logs listener startup failures without throwing and reconnects", async () => {
  const client = createFakeClient();
  const reconnectClient = createFakeClient();
  const error = new Error("connect_failed");
  client.connect.mockRejectedValueOnce(error);
  const createClientImpl = vi
    .fn()
    .mockReturnValueOnce(client)
    .mockReturnValueOnce(reconnectClient);
  const logErrorImpl = vi.fn();
  const logInfoImpl = vi.fn();
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    createClientImpl,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logErrorImpl,
    logInfoImpl,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
  });

  await expect(service.start()).resolves.toBeUndefined();
  expect(logErrorImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation]",
    error,
  );
  expect(client.end).toHaveBeenCalledTimes(1);
  expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledWith(
    expect.any(Function),
    1000,
  );

  timeoutControls.callbacks[0]?.();
  await vi.waitFor(() => {
    expect(reconnectClient.connect).toHaveBeenCalledTimes(1);
    expect(reconnectClient.query).toHaveBeenCalledWith(
      `LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`,
    );
  });
  expect(logInfoImpl).toHaveBeenCalledWith(
    "[search-cache][invalidation] listener reconnected",
  );

  await service.stop();
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
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    createClientImpl: () => client,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    logErrorImpl,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
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
  expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledWith(
    expect.any(Function),
    1000,
  );
});

test("search cache invalidation caps reconnect backoff and resets it after a successful reconnect", async () => {
  const failingClients = Array.from({ length: 6 }, () => createFakeClient());
  failingClients.forEach((client) => {
    client.connect.mockRejectedValueOnce(new Error("connect_failed"));
  });
  const successfulClient = createFakeClient();
  const createClientImpl = vi
    .fn()
    .mockReturnValueOnce(failingClients[0])
    .mockReturnValueOnce(failingClients[1])
    .mockReturnValueOnce(failingClients[2])
    .mockReturnValueOnce(failingClients[3])
    .mockReturnValueOnce(failingClients[4])
    .mockReturnValueOnce(failingClients[5])
    .mockReturnValueOnce(successfulClient);
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    createClientImpl,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
  });

  await service.start();
  for (let retryIndex = 0; retryIndex < 5; retryIndex += 1) {
    timeoutControls.callbacks[retryIndex]?.();
    await vi.waitFor(() => {
      expect(timeoutControls.setTimeoutImpl).toHaveBeenCalledTimes(
        retryIndex + 2,
      );
    });
  }

  expect(
    timeoutControls.setTimeoutImpl.mock.calls.map((call) => call[1]),
  ).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);

  timeoutControls.callbacks[5]?.();
  await vi.waitFor(() => {
    expect(successfulClient.query).toHaveBeenCalledWith(
      `LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`,
    );
  });

  successfulClient.emit("end");
  expect(timeoutControls.setTimeoutImpl.mock.calls.at(-1)?.[1]).toBe(1000);

  await service.stop();
});

test("search cache invalidation does not reconnect after stop clears a pending reconnect", async () => {
  const client = createFakeClient();
  const createClientImpl = vi.fn().mockReturnValue(client);
  const timeoutControls = createTimeoutControls();
  const service = createSearchCacheInvalidationService({
    clearTimeoutImpl:
      timeoutControls.clearTimeoutImpl as unknown as typeof clearTimeout,
    createClientImpl,
    databaseUrl: "postgresql://example.test/db",
    intervalMs: 0,
    markStale: vi.fn(),
    setTimeoutImpl:
      timeoutControls.setTimeoutImpl as unknown as typeof setTimeout,
  });

  await service.start();
  client.emit("end");
  await service.stop();
  timeoutControls.callbacks[0]?.();
  await Promise.resolve();

  expect(timeoutControls.clearTimeoutImpl).toHaveBeenCalledWith(
    timeoutControls.timeouts[0],
  );
  expect(createClientImpl).toHaveBeenCalledTimes(1);
});
