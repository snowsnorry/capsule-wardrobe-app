import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPersonalItems,
  type PersonalItemSource,
  type PersonalItemsPagination,
} from "../api/personalItems";
import { isLikedItem } from "../utils/likedItemState";

type PersonalItemsQueryOptions = {
  enabled?: boolean;
  forceKey?: number;
  likedOnly?: boolean;
  limit?: number;
  source?: PersonalItemSource | null;
};

type PersonalItemsPageState<T> = {
  error: boolean;
  hasLoaded: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  items: T[];
  pagination: PersonalItemsPagination;
};

type PersonalItemsQueryKey = string;

const DEFAULT_PAGE_LIMIT = 48;
const EMPTY_PAGINATION: PersonalItemsPagination = {
  hasMore: true,
  limit: DEFAULT_PAGE_LIMIT,
  nextCursor: null,
};

function getQueryKey({
  likedOnly,
  source,
}: Pick<PersonalItemsQueryOptions, "likedOnly" | "source">) {
  return `${source || "all"}:${likedOnly ? "liked" : "all"}`;
}

function getEmptyPageState<T>(
  limit = DEFAULT_PAGE_LIMIT,
): PersonalItemsPageState<T> {
  return {
    error: false,
    hasLoaded: false,
    isLoading: false,
    isLoadingMore: false,
    items: [],
    pagination: { ...EMPTY_PAGINATION, limit },
  };
}

function getItemIdentity(item: unknown) {
  if (!item || typeof item !== "object") {
    return "";
  }

  const record = item as {
    id?: unknown;
    url?: unknown;
    wardrobeId?: unknown;
  };
  return String(record.id ?? record.wardrobeId ?? record.url ?? "").trim();
}

function mergeItems<T>(current: T[], next: T[]) {
  const merged = [...current];
  const indexByKey = new Map(
    merged
      .map((item, index) => [getItemIdentity(item), index] as const)
      .filter(([key]) => Boolean(key)),
  );

  next.forEach((item) => {
    const key = getItemIdentity(item);
    const existingIndex = key ? indexByKey.get(key) : undefined;
    if (existingIndex == null) {
      if (key) indexByKey.set(key, merged.length);
      merged.push(item);
      return;
    }
    merged[existingIndex] = item;
  });

  return merged;
}

function filterPersonalItems<T>({
  items,
  likedOnly,
  source,
}: {
  items: T[];
  likedOnly: boolean;
  source: PersonalItemSource | null;
}) {
  return items.filter((item) => {
    const record = item as { source?: unknown };
    const sourceMatches = !source || record.source === source;
    const likedMatches = !likedOnly || isLikedItem(item);
    return sourceMatches && likedMatches;
  });
}

function getKnownItems<T>(
  states: Record<PersonalItemsQueryKey, PersonalItemsPageState<T>>,
) {
  return mergeItems(
    [],
    Object.values(states).flatMap((state) => state.items),
  );
}

function readItemsFromResponse<T>(
  response: Awaited<ReturnType<typeof fetchPersonalItems>>,
) {
  return Array.isArray(response.items) ? (response.items as T[]) : [];
}

function readPaginationFromResponse(
  response: Awaited<ReturnType<typeof fetchPersonalItems>>,
  limit: number,
): PersonalItemsPagination {
  return {
    hasMore: Boolean(response.pagination?.hasMore),
    limit: Number(response.pagination?.limit || limit),
    nextCursor: response.pagination?.nextCursor || null,
  };
}

// eslint-disable-next-line complexity, max-lines-per-function
function usePaginatedPersonalItems<T = Record<string, unknown>>({
  enabled = true,
  forceKey = 0,
  likedOnly = false,
  limit = DEFAULT_PAGE_LIMIT,
  source = null,
}: PersonalItemsQueryOptions = {}) {
  const [states, setStates] = useState<
    Record<PersonalItemsQueryKey, PersonalItemsPageState<T>>
  >({});
  const inFlightRequestsRef = useRef(new Map<PersonalItemsQueryKey, number>());
  const statesRef = useRef(states);
  const previousForceKeyRef = useRef(forceKey);
  const requestSeqRef = useRef(0);
  const activeKey = getQueryKey({ likedOnly, source });
  const fullKey = getQueryKey({ likedOnly: false, source: null });
  const fullState = states[fullKey];
  const canUseFullCache = Boolean(
    fullState?.hasLoaded && !fullState.pagination.hasMore,
  );
  const shouldUseClientFilter = canUseFullCache && activeKey !== fullKey;
  const activeState = states[activeKey] || getEmptyPageState<T>(limit);
  const items = shouldUseClientFilter
    ? filterPersonalItems({
        items: fullState?.items || [],
        likedOnly,
        source,
      })
    : filterPersonalItems({ items: activeState.items, likedOnly, source });

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  useEffect(() => {
    if (previousForceKeyRef.current === forceKey) {
      return;
    }

    previousForceKeyRef.current = forceKey;
    requestSeqRef.current += 1;
    inFlightRequestsRef.current.clear();
    setStates({});
  }, [forceKey]);

  const setItems = useCallback((updater: T[] | ((items: T[]) => T[])) => {
    setStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, state]) => {
          const nextItems =
            typeof updater === "function"
              ? (updater as (items: T[]) => T[])(state.items)
              : updater;
          return [key, { ...state, items: nextItems }];
        }),
      ),
    );
  }, []);

  const loadPage = useCallback(
    // eslint-disable-next-line complexity
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (!enabled || shouldUseClientFilter) {
        return;
      }

      const current =
        statesRef.current[activeKey] || getEmptyPageState<T>(limit);
      if (
        inFlightRequestsRef.current.has(activeKey) ||
        current.isLoading ||
        current.isLoadingMore ||
        (!reset && current.hasLoaded && !current.pagination.hasMore)
      ) {
        return;
      }

      const requestSeq = ++requestSeqRef.current;
      inFlightRequestsRef.current.set(activeKey, requestSeq);
      setStates((previous) => ({
        ...previous,
        [activeKey]: {
          ...(previous[activeKey] || getEmptyPageState<T>(limit)),
          error: false,
          isLoading: reset || !current.hasLoaded,
          isLoadingMore: !reset && current.hasLoaded,
          ...(reset
            ? { items: [], pagination: getEmptyPageState<T>(limit).pagination }
            : {}),
        },
      }));

      try {
        const response = await fetchPersonalItems({
          cursor: reset ? null : current.pagination.nextCursor,
          force: forceKey > 0,
          likedOnly,
          limit,
          source,
        });
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        const nextItems = readItemsFromResponse<T>(response);
        const pagination = readPaginationFromResponse(response, limit);
        setStates((previous) => {
          const previousState = reset
            ? getEmptyPageState<T>(limit)
            : previous[activeKey] || getEmptyPageState<T>(limit);
          return {
            ...previous,
            [activeKey]: {
              error: false,
              hasLoaded: true,
              isLoading: false,
              isLoadingMore: false,
              items: mergeItems(previousState.items, nextItems),
              pagination,
            },
          };
        });
      } catch {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }
        setStates((previous) => ({
          ...previous,
          [activeKey]: {
            ...(previous[activeKey] || getEmptyPageState<T>(limit)),
            error: true,
            hasLoaded: true,
            isLoading: false,
            isLoadingMore: false,
          },
        }));
      } finally {
        if (inFlightRequestsRef.current.get(activeKey) === requestSeq) {
          inFlightRequestsRef.current.delete(activeKey);
        }
      }
    },
    [
      activeKey,
      enabled,
      forceKey,
      likedOnly,
      limit,
      shouldUseClientFilter,
      source,
    ],
  );

  useEffect(() => {
    if (!enabled || shouldUseClientFilter) {
      return;
    }

    const current = statesRef.current[activeKey];
    if (!current?.hasLoaded && !current?.isLoading) {
      void loadPage({ reset: true });
    }
  }, [activeKey, enabled, loadPage, shouldUseClientFilter, states]);

  const loadMore = useCallback(() => loadPage({ reset: false }), [loadPage]);
  const refresh = useCallback(() => loadPage({ reset: true }), [loadPage]);

  return useMemo(
    () => ({
      error: activeState.error,
      hasMore: shouldUseClientFilter ? false : activeState.pagination.hasMore,
      isLoading: shouldUseClientFilter ? false : activeState.isLoading,
      isLoadingMore: shouldUseClientFilter ? false : activeState.isLoadingMore,
      items,
      knownItems: getKnownItems(states),
      loadMore,
      refresh,
      setItems,
    }),
    [
      activeState.error,
      activeState.isLoading,
      activeState.isLoadingMore,
      activeState.pagination.hasMore,
      items,
      loadMore,
      refresh,
      setItems,
      shouldUseClientFilter,
      states,
    ],
  );
}

async function fetchAllPersonalItemsPages<T = Record<string, unknown>>({
  likedOnly = false,
  limit = DEFAULT_PAGE_LIMIT,
  source = null,
}: Pick<PersonalItemsQueryOptions, "likedOnly" | "limit" | "source"> = {}) {
  const items: T[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchPersonalItems({
      cursor,
      force: true,
      likedOnly,
      limit,
      source,
    });
    items.push(...readItemsFromResponse<T>(response));
    const pagination = readPaginationFromResponse(response, limit);
    hasMore = pagination.hasMore;
    cursor = pagination.nextCursor;
    if (hasMore && !cursor) {
      break;
    }
  }

  return mergeItems([], items);
}

export { fetchAllPersonalItemsPages, usePaginatedPersonalItems };
