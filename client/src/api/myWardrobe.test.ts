import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  getCachedJson: vi.fn(),
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
  downloadMyWardrobePdf,
  fetchMyWardrobeItems,
  getWardrobeItemsPdfUrl,
  getWardrobeItemsUrl,
  removeCatalogItemFromMyWardrobe,
  saveCatalogItemToMyWardrobe,
  uploadWardrobeImages,
} from "./myWardrobe";

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

describe("my wardrobe api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requestApi.getCachedJson.mockReset();
    requestApi.getCachedJson.mockResolvedValue({ ok: true, items: [] });
    requestApi.request.mockReset();
    requestApi.request.mockResolvedValue(createResponse() as Response);
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ ok: true, items: [] });
    fetchEventSourceApi.fetchEventSource.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:my-wardrobe-pdf"),
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
  });

  test("fetches my wardrobe items", async () => {
    await fetchMyWardrobeItems({ source: "from_catalog", force: true });

    expect(requestApi.getCachedJson).toHaveBeenCalledWith(
      "https://api.example.test/wardrobe/items?source=from_catalog",
      {
        credentials: "include",
        force: true,
      },
    );
    expect(requestApi.requestJson).not.toHaveBeenCalled();
  });

  test("uploads wardrobe images as multipart form data", async () => {
    const file = new File(["image"], "shirt.png", { type: "image/png" });
    const onProgress = vi.fn();
    fetchEventSourceApi.fetchEventSource.mockImplementation(
      async (_url, options) => {
        await options.onopen({
          ok: true,
          status: 200,
          headers: { get: () => "text/event-stream; charset=utf-8" },
        });
        options.onmessage({
          event: "progress",
          data: JSON.stringify({
            total: 1,
            uploaded: 1,
            completedSteps: 1,
            metadataProcessed: 0,
            imageProcessed: 0,
            failed: 0,
          }),
        });
        options.onmessage({
          event: "complete",
          data: JSON.stringify({
            ok: true,
            total: 1,
            uploaded: 1,
            completedSteps: 3,
            metadataProcessed: 1,
            imageProcessed: 1,
            failed: 0,
            items: [{ id: "uploaded-1" }],
          }),
        });
        options.onclose();
      },
    );

    const result = await uploadWardrobeImages([file], { onProgress });

    expect(fetchEventSourceApi.fetchEventSource).toHaveBeenCalledTimes(1);
    const [url, options] = fetchEventSourceApi.fetchEventSource.mock.calls[0];
    expect(url).toBe("https://api.example.test/wardrobe/items/upload");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).getAll("images")).toEqual([file]);
    expect(onProgress).toHaveBeenLastCalledWith({
      total: 1,
      uploaded: 1,
      completedSteps: 3,
      metadataProcessed: 1,
      imageProcessed: 1,
      failed: 0,
    });
    expect(result).toEqual({
      ok: true,
      total: 1,
      uploaded: 1,
      completedSteps: 3,
      metadataProcessed: 1,
      imageProcessed: 1,
      failed: 0,
      items: [{ id: "uploaded-1" }],
    });
  });

  test("saves catalog items to my wardrobe", async () => {
    await saveCatalogItemToMyWardrobe("https://example.com/1");

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

  test("removes catalog items from my wardrobe", async () => {
    await removeCatalogItemFromMyWardrobe("https://example.com/1");

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

  test("downloads filtered my wardrobe PDF and revokes object url", async () => {
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
          "content-disposition": `attachment; filename="My-Wardrobe.pdf"; filename*=UTF-8''${encodeURIComponent("My Wardrobe.pdf")}`,
        },
      }) as Response,
    );

    await downloadMyWardrobePdf({ source: "uploaded" });

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
    expect(createdAnchor?.download).toBe("My Wardrobe.pdf");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:my-wardrobe-pdf");
  });

  test("downloadMyWardrobePdf surfaces endpoint errors", async () => {
    requestApi.request.mockResolvedValueOnce(
      createResponse({
        ok: false,
        status: 404,
        jsonData: { error: "not_found" },
      }) as Response,
    );

    await expect(downloadMyWardrobePdf()).rejects.toMatchObject({
      message: "not_found",
      status: 404,
    });
  });
});
