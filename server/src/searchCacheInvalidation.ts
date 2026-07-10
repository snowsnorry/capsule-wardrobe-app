import { Client } from "@neondatabase/serverless";
import { logError, logInfo } from "./logger.js";

const SEARCH_PRODUCT_OPTIONS_CHANNEL = "products_catalog_changed";
const SEARCH_PRODUCT_OPTIONS_STALE_INTERVAL_MS = 60 * 60 * 1000;
const SEARCH_CACHE_HEARTBEAT_INTERVAL_MS = 25 * 1000;
const SEARCH_CACHE_RECONNECT_INITIAL_DELAY_MS = 1000;
const SEARCH_CACHE_RECONNECT_MAX_DELAY_MS = 30 * 1000;

type NotificationMessage = {
  channel?: string;
};

type SearchCacheListenerClient = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  query: (queryText: string) => Promise<unknown>;
};

type SearchCacheInvalidationServiceOptions = {
  clearIntervalImpl?: typeof clearInterval;
  clearTimeoutImpl?: typeof clearTimeout;
  createClientImpl?: (databaseUrl: string) => SearchCacheListenerClient;
  databaseUrl?: string;
  enabled?: boolean;
  heartbeatIntervalMs?: number;
  intervalMs?: number;
  logErrorImpl?: typeof logError;
  logInfoImpl?: typeof logInfo;
  markStale: () => void;
  setIntervalImpl?: typeof setInterval;
  setTimeoutImpl?: typeof setTimeout;
};

type SearchCacheInvalidationService = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type SearchCacheInvalidationState = {
  client: SearchCacheListenerClient | null;
  heartbeatTimer: NodeJS.Timeout | null;
  reconnectAttempt: number;
  reconnectTimer: NodeJS.Timeout | null;
  started: boolean;
  staleTimer: NodeJS.Timeout | null;
};

type ConnectSearchCacheListenerOptions = {
  clearIntervalImpl: typeof clearInterval;
  createClientImpl: (databaseUrl: string) => SearchCacheListenerClient;
  databaseUrl: string;
  heartbeatIntervalMs: number;
  isReconnect: boolean;
  logErrorImpl: typeof logError;
  logInfoImpl: typeof logInfo;
  markStale: () => void;
  scheduleReconnect: (listenerClient: SearchCacheListenerClient) => void;
  setIntervalImpl: typeof setInterval;
  state: SearchCacheInvalidationState;
};

type ScheduleSearchCacheReconnectOptions = {
  listenerClient: SearchCacheListenerClient;
  logInfoImpl: typeof logInfo;
  reconnect: () => void;
  setTimeoutImpl: typeof setTimeout;
  state: SearchCacheInvalidationState;
};

/* c8 ignore next 3 */
function createDefaultListenerClient(
  databaseUrl: string,
): SearchCacheListenerClient {
  return new Client(databaseUrl);
}

function isProductsCatalogNotification(message: unknown) {
  return (
    (message as NotificationMessage | null)?.channel ===
    SEARCH_PRODUCT_OPTIONS_CHANNEL
  );
}

function attachSearchCacheListenerHandlers({
  clearIntervalImpl,
  listenerClient,
  logErrorImpl,
  logInfoImpl,
  markStale,
  scheduleReconnect,
  state,
}: Omit<
  ConnectSearchCacheListenerOptions,
  | "createClientImpl"
  | "databaseUrl"
  | "heartbeatIntervalMs"
  | "isReconnect"
  | "setIntervalImpl"
> & {
  listenerClient: SearchCacheListenerClient;
}) {
  listenerClient.on("notification", (message) => {
    if (isProductsCatalogNotification(message)) {
      markStale();
    }
  });
  listenerClient.on("error", (error) => {
    logErrorImpl("[search-cache][invalidation]", error);
  });
  listenerClient.on("end", () => {
    const wasActiveClient = state.client === listenerClient;
    logInfoImpl("[search-cache][invalidation] listener ended");
    if (wasActiveClient) {
      clearSearchCacheHeartbeatTimer(state, clearIntervalImpl);
      scheduleReconnect(listenerClient);
    }
  });
}

async function connectSearchCacheListener({
  clearIntervalImpl,
  createClientImpl,
  databaseUrl,
  heartbeatIntervalMs,
  isReconnect,
  logErrorImpl,
  logInfoImpl,
  markStale,
  scheduleReconnect,
  setIntervalImpl,
  state,
}: ConnectSearchCacheListenerOptions) {
  if (!state.started) {
    return;
  }

  const listenerClient = createClientImpl(databaseUrl);
  state.client = listenerClient;
  attachSearchCacheListenerHandlers({
    clearIntervalImpl,
    listenerClient,
    logErrorImpl,
    logInfoImpl,
    markStale,
    scheduleReconnect,
    state,
  });

  try {
    await listenerClient.connect();
    await listenerClient.query(`LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`);
    startSearchCacheHeartbeat({
      heartbeatIntervalMs,
      listenerClient,
      logErrorImpl,
      setIntervalImpl,
      state,
    });
    state.reconnectAttempt = 0;
    logInfoImpl(
      isReconnect
        ? "[search-cache][invalidation] listener reconnected"
        : "[search-cache][invalidation] listener started",
    );
  } catch (error) {
    logErrorImpl("[search-cache][invalidation]", error);
    if (state.client === listenerClient) {
      state.client = null;
    }
    await listenerClient.end().catch((endError) => {
      logErrorImpl("[search-cache][invalidation][stop]", endError);
    });
    if (state.started) {
      state.client = listenerClient;
      scheduleReconnect(listenerClient);
    }
  }
}

function startSearchCacheHeartbeat({
  heartbeatIntervalMs,
  listenerClient,
  logErrorImpl,
  setIntervalImpl,
  state,
}: {
  heartbeatIntervalMs: number;
  listenerClient: SearchCacheListenerClient;
  logErrorImpl: typeof logError;
  setIntervalImpl: typeof setInterval;
  state: SearchCacheInvalidationState;
}) {
  if (heartbeatIntervalMs <= 0) {
    return;
  }

  state.heartbeatTimer = setIntervalImpl(() => {
    if (state.client !== listenerClient) {
      return;
    }
    void listenerClient.query("SELECT 1").catch((error) => {
      if (state.client === listenerClient) {
        logErrorImpl("[search-cache][invalidation][heartbeat]", error);
      }
    });
  }, heartbeatIntervalMs);
  state.heartbeatTimer.unref?.();
}

function scheduleSearchCacheReconnect({
  listenerClient,
  logInfoImpl,
  reconnect,
  setTimeoutImpl,
  state,
}: ScheduleSearchCacheReconnectOptions) {
  if (
    !state.started ||
    state.reconnectTimer ||
    (state.client && state.client !== listenerClient)
  ) {
    return;
  }

  state.client = null;
  state.reconnectAttempt += 1;
  const delayMs = Math.min(
    SEARCH_CACHE_RECONNECT_INITIAL_DELAY_MS * 2 ** (state.reconnectAttempt - 1),
    SEARCH_CACHE_RECONNECT_MAX_DELAY_MS,
  );
  logInfoImpl(
    `[search-cache][invalidation] reconnect scheduled in ${delayMs}ms (attempt ${state.reconnectAttempt})`,
  );
  state.reconnectTimer = setTimeoutImpl(() => {
    state.reconnectTimer = null;
    reconnect();
  }, delayMs);
  state.reconnectTimer.unref?.();
}

function clearSearchCacheReconnectTimer(
  state: SearchCacheInvalidationState,
  clearTimeoutImpl: typeof clearTimeout,
) {
  if (state.reconnectTimer) {
    clearTimeoutImpl(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}

function clearSearchCacheHeartbeatTimer(
  state: SearchCacheInvalidationState,
  clearIntervalImpl: typeof clearInterval,
) {
  if (state.heartbeatTimer) {
    clearIntervalImpl(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function startSearchCacheStaleTimer({
  intervalMs,
  markStale,
  setIntervalImpl,
  state,
}: {
  intervalMs: number;
  markStale: () => void;
  setIntervalImpl: typeof setInterval;
  state: SearchCacheInvalidationState;
}) {
  if (intervalMs > 0) {
    state.staleTimer = setIntervalImpl(markStale, intervalMs);
    state.staleTimer.unref?.();
  }
}

function createSearchCacheReconnectScheduler({
  clearIntervalImpl,
  createClientImpl,
  databaseUrl,
  heartbeatIntervalMs,
  logErrorImpl,
  logInfoImpl,
  markStale,
  setIntervalImpl,
  setTimeoutImpl,
  state,
}: Omit<
  ConnectSearchCacheListenerOptions,
  "isReconnect" | "scheduleReconnect"
> & {
  setTimeoutImpl: typeof setTimeout;
}) {
  function scheduleReconnect(listenerClient: SearchCacheListenerClient) {
    scheduleSearchCacheReconnect({
      listenerClient,
      logInfoImpl,
      reconnect: () => {
        if (!databaseUrl) return;
        void connectSearchCacheListener({
          clearIntervalImpl,
          createClientImpl,
          databaseUrl,
          heartbeatIntervalMs,
          isReconnect: true,
          logErrorImpl,
          logInfoImpl,
          markStale,
          scheduleReconnect,
          setIntervalImpl,
          state,
        });
      },
      setTimeoutImpl,
      state,
    });
  }

  return scheduleReconnect;
}

function createSearchCacheInvalidationService({
  clearIntervalImpl = clearInterval,
  clearTimeoutImpl = clearTimeout,
  createClientImpl = createDefaultListenerClient,
  databaseUrl = process.env.DATABASE_URL,
  enabled = true,
  heartbeatIntervalMs = SEARCH_CACHE_HEARTBEAT_INTERVAL_MS,
  intervalMs = SEARCH_PRODUCT_OPTIONS_STALE_INTERVAL_MS,
  logErrorImpl = logError,
  logInfoImpl = logInfo,
  markStale,
  setIntervalImpl = setInterval,
  setTimeoutImpl = setTimeout,
}: SearchCacheInvalidationServiceOptions): SearchCacheInvalidationService {
  const state: SearchCacheInvalidationState = {
    client: null,
    heartbeatTimer: null,
    reconnectAttempt: 0,
    reconnectTimer: null,
    started: false,
    staleTimer: null,
  };

  const scheduleReconnect = createSearchCacheReconnectScheduler({
    clearIntervalImpl,
    createClientImpl,
    databaseUrl,
    heartbeatIntervalMs,
    logErrorImpl,
    logInfoImpl,
    markStale,
    setIntervalImpl,
    setTimeoutImpl,
    state,
  });

  async function start() {
    if (state.started) return;
    state.started = true;
    markStale();
    startSearchCacheStaleTimer({
      intervalMs,
      markStale,
      setIntervalImpl,
      state,
    });

    if (!enabled) {
      return;
    }
    if (!databaseUrl) {
      logErrorImpl(
        "[search-cache][invalidation]",
        "DATABASE_URL is not set; LISTEN disabled",
      );
      return;
    }

    await connectSearchCacheListener({
      clearIntervalImpl,
      createClientImpl,
      databaseUrl,
      heartbeatIntervalMs,
      isReconnect: false,
      logErrorImpl,
      logInfoImpl,
      markStale,
      scheduleReconnect,
      setIntervalImpl,
      state,
    });
  }

  async function stop() {
    state.started = false;
    clearSearchCacheReconnectTimer(state, clearTimeoutImpl);
    clearSearchCacheHeartbeatTimer(state, clearIntervalImpl);
    if (state.staleTimer) {
      clearIntervalImpl(state.staleTimer);
      state.staleTimer = null;
    }
    const listenerClient = state.client;
    state.client = null;
    if (listenerClient) {
      await listenerClient.end().catch((error) => {
        logErrorImpl("[search-cache][invalidation][stop]", error);
      });
    }
  }

  return { start, stop };
}

export { SEARCH_PRODUCT_OPTIONS_CHANNEL, createSearchCacheInvalidationService };
export type { SearchCacheListenerClient };
