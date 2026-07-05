import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCsrfHeader: vi.fn(() => ({ "X-CSRF-Token": "csrf-token" })),
  request: vi.fn(),
  requestJson: vi.fn(),
}));
const eventSourceApi = vi.hoisted(() => ({
  fetchEventSource: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));
vi.mock("@microsoft/fetch-event-source", () => eventSourceApi);

import { addJobSnapshotListener } from "./jobs";
import {
  createCapsule,
  deleteCapsule,
  deleteCapsuleReport,
  duplicateCapsule,
  fetchCapsule,
  fetchRecentCapsules,
  fetchSharedCapsule,
  generateCapsuleReport,
  importSharedCapsule,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  selectCapsule,
  setCapsulePin,
  shareCapsule,
  updateCapsuleFilters,
  updateCapsuleRejectedUrls,
} from "./capsules";

function createJobResponse(id = "job-1", kind = "capsuleReportGenerate") {
  return {
    ok: true,
    job: {
      id,
      kind,
      status: "queued",
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "capsule", id: "capsule-1" },
      result: null,
      error: null,
      createdAt: "",
      updatedAt: "",
      startedAt: null,
      completedAt: null,
      failedAt: null,
    },
  } as const;
}

describe("capsules api", () => {
  beforeEach(() => {
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
    eventSourceApi.fetchEventSource.mockReset();
    window.history.replaceState({}, "", "/");
  });

  test("createCapsule only sends name and filters", async () => {
    await createCapsule({
      name: "Spring edit",
      filters: {
        audience: "woman",
      },
      draft: {
        filters: { audience: "man" },
        data: {
          wardrobe: { items: [{ url: "https://example.com/1" }] },
          rejectedUrls: ["https://example.com/1"],
        },
      },
      saved: {
        filters: { audience: "man" },
      },
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Spring edit",
          filters: {
            audience: "woman",
          },
        }),
      },
    );
  });

  test("createCapsule omits blank name and invalid filters", async () => {
    await createCapsule({
      name: " ",
      filters: null,
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules",
      expect.objectContaining({
        body: JSON.stringify({}),
      }),
    );
  });

  test("read helpers use capsule collection routes", async () => {
    await fetchRecentCapsules();
    await fetchRecentCapsules({ limit: 10, offset: 20 });
    await fetchCapsule("capsule-1");
    await searchCapsules(" linen jacket ");
    await searchCapsules(" ");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/recent",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules/recent?limit=10&offset=20",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/capsules/capsule-1",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/capsules/search?q=linen%20jacket",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      5,
      "https://api.example.test/capsules/search",
      {
        credentials: "include",
      },
    );
  });

  test("capsule mutation helpers use explicit filters and rejected urls routes", async () => {
    await updateCapsuleFilters("capsule-1", { audience: "woman" });
    await updateCapsuleRejectedUrls("capsule-1", ["https://example.com/1"]);

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/filters",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { audience: "woman" },
        }),
      },
    );

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules/capsule-1/rejected-urls",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectedUrls: ["https://example.com/1"],
        }),
      },
    );
  });

  test("updateCapsuleFilters appends only regenerate query flag when requested", async () => {
    requestApi.requestJson.mockResolvedValueOnce(
      createJobResponse("job-1", "capsuleGenerate"),
    );
    const onSnapshot = vi.fn();
    const unsubscribe = addJobSnapshotListener(onSnapshot);

    await expect(
      updateCapsuleFilters(
        "capsule-1",
        { audience: "woman" },
        { regenerate: true },
      ),
    ).resolves.toEqual(createJobResponse("job-1", "capsuleGenerate"));
    unsubscribe();

    expect(onSnapshot).toHaveBeenCalledWith(
      createJobResponse("job-1", "capsuleGenerate").job,
    );
    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/filters?regenerate=true",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { audience: "woman" },
        }),
      },
    );
  });

  test("updateCapsuleFilters preserves non-job mutation responses", async () => {
    requestApi.requestJson.mockResolvedValueOnce({ ok: true });

    await expect(
      updateCapsuleFilters(
        "capsule-1",
        { audience: "woman" },
        { regenerate: true },
      ),
    ).resolves.toEqual({ ok: true });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/filters?regenerate=true",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { audience: "woman" },
        }),
      },
    );
  });

  test("share helpers use capsule and shared-capsule routes", async () => {
    await shareCapsule("capsule-1");
    await fetchSharedCapsule("share/1");
    await importSharedCapsule("share/1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/share",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/shared-capsules/share%2F1",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/shared-capsules/share%2F1/import",
      {
        method: "POST",
        credentials: "include",
      },
    );
  });

  test("capsule state mutation helpers use their dedicated routes", async () => {
    await saveCapsule("capsule-1");
    await revertCapsule("capsule-1");
    await renameCapsule("capsule-1", "Renamed");
    await setCapsulePin("capsule-1", true);
    await duplicateCapsule("capsule-1");
    await duplicateCapsule("capsule-1", "Copy");
    await selectCapsule("capsule-1");
    await deleteCapsule("capsule-1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/save",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules/capsule-1/revert",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/capsules/capsule-1/rename",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/capsules/capsule-1/pin",
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: true }),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      5,
      "https://api.example.test/capsules/capsule-1/duplicate",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      6,
      "https://api.example.test/capsules/capsule-1/duplicate",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Copy" }),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      7,
      "https://api.example.test/capsules/capsule-1/select",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      8,
      "https://api.example.test/capsules/capsule-1",
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  });

  test("generates and deletes capsule reports", async () => {
    requestApi.requestJson.mockResolvedValueOnce(createJobResponse());

    await expect(generateCapsuleReport("capsule-1")).resolves.toEqual(
      createJobResponse(),
    );
    await deleteCapsuleReport("capsule-1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/report",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/report",
      { method: "DELETE", credentials: "include" },
    );
  });

  test("rejects capsule report enqueue failures", async () => {
    requestApi.requestJson.mockRejectedValueOnce(
      new Error("service_unavailable"),
    );

    await expect(generateCapsuleReport("capsule-1")).rejects.toThrow(
      "service_unavailable",
    );
  });

  test("capsule id routes encode path segments", async () => {
    await fetchCapsule("capsule 1");
    await selectCapsule("capsule 1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule%201",
      {
        credentials: "include",
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules/capsule%201/select",
      {
        method: "POST",
        credentials: "include",
      },
    );
  });
});
