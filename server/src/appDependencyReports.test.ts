import { beforeEach, expect, test, vi } from "vitest";

const dbApi = vi.hoisted(() => ({
  clearJobRunsForEmail: vi.fn(async () => undefined),
  getProductsByUrlsForEmailInOrder: vi.fn(),
  listWardrobeItemsByEmail: vi.fn(),
  listWardrobeItemsByUrlsForEmail: vi.fn(),
  upsertPersonalItemsReportByEmail: vi.fn(),
}));
const reportServicesApi = vi.hoisted(() => ({
  generateCapsuleReport: vi.fn(),
  generateOutfitReport: vi.fn(),
  generatePersonalItemsReport: vi.fn(),
}));
const capsuleStoreApi = vi.hoisted(() => ({
  updateCapsuleReport: vi.fn(),
}));
const outfitStoreApi = vi.hoisted(() => ({
  updateOutfitReport: vi.fn(),
}));
const wardrobePdfJobRegistryApi = vi.hoisted(() => ({
  deleteWardrobePdfJob: vi.fn(),
}));

vi.mock("./ai/capsuleReportService.js", () => reportServicesApi);
vi.mock("./ai/outfitReportService.js", () => reportServicesApi);
vi.mock("./ai/personalItemsReportService.js", () => reportServicesApi);
vi.mock("./capsuleStore.js", () => capsuleStoreApi);
vi.mock("./db.js", () => dbApi);
vi.mock("./outfitStore.js", () => outfitStoreApi);
vi.mock("./wardrobePdfJobRegistry.js", () => wardrobePdfJobRegistryApi);

import { createAccountCleanupDependencies } from "./appDependencyReports.js";

beforeEach(() => {
  vi.clearAllMocks();
});

test("account cleanup dependencies clear transient PDF and persisted jobs", async () => {
  const deps = createAccountCleanupDependencies();

  await deps.clearAccountTransientStateImpl("person@example.com");

  expect(wardrobePdfJobRegistryApi.deleteWardrobePdfJob).toHaveBeenCalledWith(
    "person@example.com",
  );
  expect(dbApi.clearJobRunsForEmail).toHaveBeenCalledWith("person@example.com");
});
