import { beforeEach, expect, test, vi } from "vitest";

const aiApi = vi.hoisted(() => ({
  clearWardrobeJobsForEmail: vi.fn(),
}));
const partialRegenerationJobsApi = vi.hoisted(() => ({
  clearPartialRegenerationJobsForEmail: vi.fn(),
}));
const outfitSetImageJobsApi = vi.hoisted(() => ({
  clearOutfitSetImageJobsForEmail: vi.fn(),
}));
const outfitImageJobsApi = vi.hoisted(() => ({
  clearOutfitImageJobsForEmail: vi.fn(),
}));
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

vi.mock("./ai/ai.js", () => aiApi);
vi.mock("./ai/partialRegenerationJobs.js", () => partialRegenerationJobsApi);
vi.mock("./ai/outfitSetImageJobs.js", () => outfitSetImageJobsApi);
vi.mock("./ai/outfitImageJobs.js", () => outfitImageJobsApi);
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

test("account cleanup dependencies clear transient in-memory and persisted jobs", async () => {
  const deps = createAccountCleanupDependencies();

  await deps.clearAccountTransientStateImpl("person@example.com");

  expect(aiApi.clearWardrobeJobsForEmail).toHaveBeenCalledWith(
    "person@example.com",
  );
  expect(
    partialRegenerationJobsApi.clearPartialRegenerationJobsForEmail,
  ).toHaveBeenCalledWith("person@example.com");
  expect(
    outfitSetImageJobsApi.clearOutfitSetImageJobsForEmail,
  ).toHaveBeenCalledWith("person@example.com");
  expect(outfitImageJobsApi.clearOutfitImageJobsForEmail).toHaveBeenCalledWith(
    "person@example.com",
  );
  expect(wardrobePdfJobRegistryApi.deleteWardrobePdfJob).toHaveBeenCalledWith(
    "person@example.com",
  );
  expect(dbApi.clearJobRunsForEmail).toHaveBeenCalledWith("person@example.com");
});
