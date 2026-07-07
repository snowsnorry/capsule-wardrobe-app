import type { JobKind } from "../jobs/types.js";

export type E2eScenario =
  | "with-profile"
  | "no-profile"
  | "with-saved-search"
  | "with-non-empty-stats"
  | "empty-wardrobe";

export type E2eSession = {
  email: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
};

export type E2ePersonalItemsReportSnapshot = {
  generatedAt: string;
  personalItemUrls: string[];
  report: Record<string, unknown>;
};

export type E2eJobControls = {
  clearAll: () => void;
  completeManualJob: (id: string) => Promise<unknown | null>;
  failManualJob: (id: string, errorCode?: string) => unknown | null;
  getManualMode: () => JobKind[];
  setManualMode: (kinds: JobKind[]) => JobKind[];
};
