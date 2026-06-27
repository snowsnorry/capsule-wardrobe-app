import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
  getCsrfHeader: vi.fn(() => ({ "X-CSRF-Token": "csrf-token" })),
  request: vi.fn(),
  requestJson: vi.fn(),
}));
const fetchEventSourceApi = vi.hoisted(() => ({
  fetchEventSource: vi.fn(),
}));

vi.mock("@microsoft/fetch-event-source", () => fetchEventSourceApi);
vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import {
  deletePersonalItemsReport,
  deleteUploadedWardrobeItem,
  downloadPersonalItemsPdf,
  fetchPersonalItems,
  fetchPersonalItemsReport,
  fetchUploadedWardrobeItemDetail,
  generatePersonalItemsReport,
  getPersonalItemsReportUrl,
  getWardrobeItemsPdfUrl,
  getWardrobeItemsUrl,
  removeCatalogItemFromPersonalItems,
  saveCatalogItemToPersonalItems,
  updateUploadedWardrobeItem,
  uploadWardrobeImages,
  uploadWardrobeUrls,
} from "./personalItems";

type HeaderMap = Record<string, string>;
type MockResponse = Pick<Response, "blob" | "json" | "ok" | "status"> & {
  headers: Pick<Headers, "get">;
};

function createResponse({
  ok = true,
  status = 200,
  jsonData = undefined,
  jsonError = null,
  blobData = null,
  headers = {},
}: {
  blobData?: Blob | null;
  headers?: HeaderMap;
  jsonData?: unknown;
  jsonError?: Error | null;
  ok?: boolean;
  status?: number;
} = {}): MockResponse {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      },
    },
    async json() {
      if (jsonError) {
        throw jsonError;
      }
      return jsonData;
    },
    async blob() {
      return blobData ?? new Blob(["pdf"]);
    },
  };
}

function createJobResponse(kind = "personalItemsReportGenerate") {
  return {
    ok: true,
    job: {
      id: "job-1",
      kind,
      status: "queued",
      phase: "queued",
      progress: { current: 0, total: null, label: null },
      entity: { type: "wardrobe", id: null },
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

describe("personal items api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requestApi.getCachedJson.mockReset();
    requestApi.getCachedJson.mockResolvedValue({ ok: true, items: [] });
    requestApi.getCsrfHeader.mockReset();
    requestApi.getCsrfHeader.mockReturnValue({ "X-CSRF-Token": "csrf-token" });
    requestApi.request.mockReset();
    requestApi.request.mockResolvedValue(createResponse() as Response);
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ ok: true, items: [] });
    fetchEventSourceApi.fetchEventSource.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:personal-items-pdf"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("builds list URLs with optional source filters", () => {
    expect(getWardrobeItemsUrl()).toBe(
      "https://api.example.test/wardrobe/items",
    );
    expect(getWardrobeItemsUrl({ source: "uploaded" })).toBe(
      "https://api.example.test/wardrobe/items?source=uploaded",
    );
    expect(getWardrobeItemsPdfUrl()).toBe(
      "https://api.example.test/wardrobe/items/pdf",
    );
    expect(getWardrobeItemsPdfUrl({ source: "from_catalog" })).toBe(
      "https://api.example.test/wardrobe/items/pdf?source=from_catalog",
    );
    expect(getPersonalItemsReportUrl()).toBe(
      "https://api.example.test/wardrobe/items/report",
    );
  });

  test("fetches personal items items", async () => {
    await fetchPersonalItems({ source: "from_catalog", force: true });

    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items?source=from_catalog",
      {
        credentials: "include",
        force: true,
      },
    );
    expect(requestApi.requestJson).not.toHaveBeenCalled();
  });

  test("fetches uploaded personal item detail", async () => {
    await fetchUploadedWardrobeItemDetail("uploaded 1");

    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/uploaded/uploaded%201",
      {
        credentials: "include",
        ttlMs: 60_000,
      },
    );
  });

  test("fetches personal items report", async () => {
    requestApi.getCachedJson.mockResolvedValueOnce({
      ok: true,
      report: { verdict: { score: 0.8 } },
      stale: true,
      generatedAt: "2026-06-19T10:00:00.000Z",
    });

    await expect(fetchPersonalItemsReport({ force: true })).resolves.toEqual({
      ok: true,
      report: { verdict: { score: 0.8 } },
      stale: true,
      generatedAt: "2026-06-19T10:00:00.000Z",
    });

    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/report",
      {
        credentials: "include",
        force: true,
      },
    );
  });

  test("generates personal items report as a queued job", async () => {
    requestApi.requestJson.mockResolvedValueOnce(createJobResponse());

    await expect(generatePersonalItemsReport()).resolves.toEqual(
      createJobResponse(),
    );

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/report",
      {
        method: "POST",
        credentials: "include",
      },
    );
  });

  test("personal items report generation surfaces enqueue failures", async () => {
    requestApi.requestJson.mockRejectedValueOnce(new Error("not_found"));

    await expect(generatePersonalItemsReport()).rejects.toThrow("not_found");
  });

  test("uploads wardrobe images as multipart form data", async () => {
    const file = new File(["image"], "shirt.png", { type: "image/png" });
    const onProgress = vi.fn();
    requestApi.requestJson.mockResolvedValueOnce(
      createJobResponse("personalItemUploadFiles"),
    );

    const result = await uploadWardrobeImages([file], { onProgress });

    expect(requestApi.requestJson).toHaveBeenCalledTimes(1);
    const [url, options] = requestApi.requestJson.mock.calls[0];
    expect(url).toBe("https://api.example.test/wardrobe/items/upload");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).getAll("images")).toEqual([file]);
    expect(onProgress).toHaveBeenLastCalledWith({
      total: 1,
      uploaded: 0,
      completedSteps: 0,
      metadataProcessed: 0,
      imageProcessed: 0,
      failed: 0,
    });
    expect(result).toEqual(createJobResponse("personalItemUploadFiles"));
  });

  test("uploads wardrobe URLs as a queued job", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue("csrf=csrf-token");
    const onProgress = vi.fn();
    requestApi.requestJson.mockResolvedValueOnce(
      createJobResponse("personalItemUploadUrls"),
    );

    const result = await uploadWardrobeUrls(
      ["https://shop.example.com/product"],
      { onProgress },
    );

    expect(requestApi.requestJson).toHaveBeenCalledTimes(1);
    const [url, options] = requestApi.requestJson.mock.calls[0];
    expect(url).toBe("https://api.example.test/wardrobe/items/upload-url");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });
    expect(options.body).toBe(
      JSON.stringify({ urls: ["https://shop.example.com/product"] }),
    );
    expect(onProgress).toHaveBeenLastCalledWith({
      total: 1,
      uploaded: 0,
      completedSteps: 0,
      metadataProcessed: 0,
      imageProcessed: 0,
      failed: 0,
    });
    expect(result).toEqual(createJobResponse("personalItemUploadUrls"));
  });

  test("saves catalog items to personal items", async () => {
    await saveCatalogItemToPersonalItems("https://example.com/1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/from-catalog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: "https://example.com/1" }),
      },
    );
  });

  test("removes catalog items from personal items", async () => {
    await removeCatalogItemFromPersonalItems("https://example.com/1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/from-catalog",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: "https://example.com/1" }),
      },
    );
  });

  test("updates uploaded personal item metadata", async () => {
    const payload = {
      name: "Linen shirt",
      description: "Button-front shirt",
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: ["casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      colorBase: ["white"],
      pattern: "solid",
      finish: null,
      composition: "linen, cotton",
      silhouette: null,
      fit: "regular",
      closureType: ["button"],
    };

    await updateUploadedWardrobeItem("uploaded-1", payload);

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/uploaded/uploaded-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      },
    );
  });

  test("deletes uploaded personal items", async () => {
    await deleteUploadedWardrobeItem("uploaded 1");

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/uploaded/uploaded%201",
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  });

  test("deletes personal items report", async () => {
    await deletePersonalItemsReport();

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/report",
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  });

  test("downloads filtered personal items PDF and revokes object url", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorMethods = { click: vi.fn(), remove: vi.fn() };
    let createdAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === "a") {
        element.click = anchorMethods.click;
        element.remove = anchorMethods.remove;
        createdAnchor = element as HTMLAnchorElement;
      }
      return element;
    });

    requestApi.request.mockResolvedValueOnce(
      createResponse({
        status: 200,
        ok: true,
        blobData: new Blob(["pdf-binary"], { type: "application/pdf" }),
        headers: {
          "content-disposition": `attachment; filename="Personal-items.pdf"; filename*=UTF-8''${encodeURIComponent("Personal items.pdf")}`,
        },
      }) as Response,
    );

    await downloadPersonalItemsPdf({ source: "uploaded" });

    expect(requestApi.request).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items/pdf?source=uploaded",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorMethods.click).toHaveBeenCalledTimes(1);
    expect(anchorMethods.remove).toHaveBeenCalledTimes(1);
    expect(createdAnchor?.download).toBe("Personal items.pdf");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:personal-items-pdf");
  });

  test("downloadPersonalItemsPdf surfaces endpoint errors", async () => {
    requestApi.request.mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 404,
        jsonData: { error: "not_found" },
      }) as Response,
    );

    await expect(downloadPersonalItemsPdf()).rejects.toMatchObject({
      message: "not_found",
      status: 404,
    });
  });
});
