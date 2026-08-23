import { deepClone } from "./capsuleState.js";
import { buildE2eWardrobeItems } from "./fixtures.js";

type E2eSearchGateMatch = "exact" | "includes";

type E2eSearchGateConfig = {
  query: string;
  match: E2eSearchGateMatch;
};

type E2eSearchRequestLogEntry = {
  order: number;
  query: string;
  queryKey: string;
  gated: boolean;
  released: boolean;
  completed: boolean;
};

type E2eSearchGateWaiter = {
  order: number;
  release: () => void;
};

type E2eSearchGate = E2eSearchGateConfig & {
  queryKey: string;
  waiters: E2eSearchGateWaiter[];
};

function normalizeSearchQueryKey(query: unknown): string {
  return String(query || "")
    .trim()
    .toLowerCase();
}

function normalizeSearchGateMatch(value: unknown): E2eSearchGateMatch {
  return value === "includes" ? "includes" : "exact";
}

function payloadIncludes(payload, field: string, value: string) {
  return Array.isArray(payload?.[field]) && payload[field].includes(value);
}

function isUrlSearchPayload(payload) {
  const query = String(payload?.query || "").trim();
  return query.startsWith("http://") || query.startsWith("https://");
}

function hasSavedFilterPayload(payload) {
  return (
    payloadIncludes(payload, "category", "top") &&
    payloadIncludes(payload, "color", "navy")
  );
}

export function buildSearchResultItems(payload) {
  const items = buildE2eWardrobeItems();
  const query = String(payload?.query || "").trim();
  const queryKey = normalizeSearchQueryKey(query);
  if (isUrlSearchPayload(payload)) {
    return items.filter((item) => item.url === query);
  }

  if (queryKey.includes("e2e-first") || queryKey.includes("first query")) {
    return items.filter((item) => item.id === "top-e2e");
  }

  if (queryKey.includes("e2e-second") || queryKey.includes("second query")) {
    return items.filter((item) => item.id === "sporty-overshirt-e2e");
  }

  if (payloadIncludes(payload, "style", "sporty")) {
    return items.filter((item) => item.id === "sporty-overshirt-e2e");
  }

  if (payload?.exactColor === "#203a5f") {
    return items
      .filter((item) =>
        ["top-e2e", "sporty-overshirt-e2e"].includes(String(item.id)),
      )
      .map((item, index) => ({
        ...item,
        matchedColor: index === 0 ? "#203a5f" : "#263e63",
        matchedColorShare: index === 0 ? 0.82 : 0.48,
        matchedColorIndex: 0,
        colorDistance: index === 0 ? 0 : 3.4,
      }));
  }

  if (hasSavedFilterPayload(payload)) {
    return items.filter((item) => item.id === "top-e2e");
  }

  return items.filter((item) =>
    ["top-e2e", "bottom-e2e", "shoes-e2e"].includes(String(item.id)),
  );
}

export class E2eSearchDelayState {
  private requestCounter = 0;
  private gates: E2eSearchGate[] = [];
  private requestLog: E2eSearchRequestLogEntry[] = [];

  configureGate(payload: {
    query?: unknown;
    match?: unknown;
  }): E2eSearchGateConfig {
    const query = String(payload.query || "").trim();
    const match = normalizeSearchGateMatch(payload.match);
    const gate: E2eSearchGate = {
      query,
      queryKey: normalizeSearchQueryKey(query),
      match,
      waiters: [],
    };
    this.gates.push(gate);
    return { query: gate.query, match: gate.match };
  }

  async waitForGate(payload: { query?: unknown }): Promise<number> {
    const query = String(payload.query || "").trim();
    const queryKey = normalizeSearchQueryKey(query);
    const gate = this.findGate(queryKey);
    this.requestCounter += 1;
    const logEntry: E2eSearchRequestLogEntry = {
      order: this.requestCounter,
      query,
      queryKey,
      gated: Boolean(gate),
      released: false,
      completed: false,
    };
    this.requestLog.push(logEntry);

    if (!gate) return logEntry.order;

    await new Promise<void>((resolve) => {
      gate.waiters.push({
        order: logEntry.order,
        release: () => {
          logEntry.released = true;
          resolve();
        },
      });
    });
    return logEntry.order;
  }

  completeRequest(order: number) {
    const logEntry = this.requestLog.find(
      (candidate) => candidate.order === order,
    );
    if (logEntry) {
      logEntry.completed = true;
    }
  }

  releaseGate(payload: { query?: unknown; match?: unknown } = {}) {
    const query = String(payload.query || "").trim();
    const match = payload.match
      ? normalizeSearchGateMatch(payload.match)
      : null;
    const queryKey = normalizeSearchQueryKey(query);
    const gateIndex = this.gates.findIndex(
      (candidate) =>
        (!queryKey || candidate.queryKey === queryKey) &&
        (!match || candidate.match === match) &&
        candidate.waiters.length > 0,
    );
    if (gateIndex < 0) {
      return { released: false, order: null };
    }

    const gate = this.gates[gateIndex];
    const waiter = gate.waiters.shift();
    if (!waiter) {
      return { released: false, order: null };
    }
    waiter.release();
    if (gate.waiters.length === 0) {
      this.gates.splice(gateIndex, 1);
    }
    return { released: true, order: waiter.order };
  }

  cloneRequestLog(): E2eSearchRequestLogEntry[] {
    return deepClone(this.requestLog);
  }

  clear() {
    for (const gate of this.gates) {
      for (const waiter of gate.waiters) {
        waiter.release();
      }
    }
    this.gates = [];
    this.requestLog = [];
    this.requestCounter = 0;
  }

  private findGate(queryKey: string): E2eSearchGate | null {
    return (
      this.gates.find((gate) =>
        gate.match === "includes"
          ? Boolean(gate.queryKey) && queryKey.includes(gate.queryKey)
          : queryKey === gate.queryKey,
      ) || null
    );
  }
}
