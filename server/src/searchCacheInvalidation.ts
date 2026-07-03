import { Client } from "@neondatabase/serverless";
import { logError, logInfo } from "./logger.js";

const SEARCH_PRODUCT_OPTIONS_CHANNEL = "products_catalog_changed";
const SEARCH_PRODUCT_OPTIONS_STALE_INTERVAL_MS = 60 * 60 * 1000;

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
  createClientImpl?: (databaseUrl: string) => SearchCacheListenerClient;
  databaseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
  logErrorImpl?: typeof logError;
  logInfoImpl?: typeof logInfo;
  markStale: () => void;
  setIntervalImpl?: typeof setInterval;
};

type SearchCacheInvalidationService = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
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

function createSearchCacheInvalidationService({
  clearIntervalImpl = clearInterval,
  createClientImpl = createDefaultListenerClient,
  databaseUrl = process.env.DATABASE_URL,
  enabled = true,
  intervalMs = SEARCH_PRODUCT_OPTIONS_STALE_INTERVAL_MS,
  logErrorImpl = logError,
  logInfoImpl = logInfo,
  markStale,
  setIntervalImpl = setInterval,
}: SearchCacheInvalidationServiceOptions): SearchCacheInvalidationService {
  let client: SearchCacheListenerClient | null = null;
  let timer: NodeJS.Timeout | null = null;
  let started = false;

  async function start() {
    if (started) return;
    started = true;
    markStale();

    if (intervalMs > 0) {
      timer = setIntervalImpl(markStale, intervalMs);
      timer.unref?.();
    }

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

    const listenerClient = createClientImpl(databaseUrl);
    client = listenerClient;
    listenerClient.on("notification", (message) => {
      if (isProductsCatalogNotification(message)) {
        markStale();
      }
    });
    listenerClient.on("error", (error) => {
      logErrorImpl("[search-cache][invalidation]", error);
    });
    listenerClient.on("end", () => {
      if (client === listenerClient) {
        client = null;
      }
      logInfoImpl("[search-cache][invalidation] listener ended");
    });

    try {
      await listenerClient.connect();
      await listenerClient.query(`LISTEN ${SEARCH_PRODUCT_OPTIONS_CHANNEL}`);
      logInfoImpl("[search-cache][invalidation] listener started");
    } catch (error) {
      logErrorImpl("[search-cache][invalidation]", error);
      if (client === listenerClient) {
        client = null;
      }
      await listenerClient.end().catch((endError) => {
        logErrorImpl("[search-cache][invalidation][stop]", endError);
      });
    }
  }

  async function stop() {
    started = false;
    if (timer) {
      clearIntervalImpl(timer);
      timer = null;
    }
    const listenerClient = client;
    client = null;
    if (listenerClient) {
      await listenerClient.end().catch((error) => {
        logErrorImpl("[search-cache][invalidation][stop]", error);
      });
    }
  }

  return { start, stop };
}

export {
  SEARCH_PRODUCT_OPTIONS_CHANNEL,
  SEARCH_PRODUCT_OPTIONS_STALE_INTERVAL_MS,
  createSearchCacheInvalidationService,
};
export type { SearchCacheInvalidationService, SearchCacheListenerClient };
