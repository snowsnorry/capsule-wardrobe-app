import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("./request.js", () => requestApi);
vi.mock("./config.js", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import {
  downloadWardrobePdf,
  fetchWardrobeItems,
  regenerateSelectedWardrobeItems
} from "./wardrobe.js";

function createResponse({
  ok = true,
  status = 200,
  jsonData = undefined,
  jsonError = null,
  blobData = null
} = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonError) {
        throw jsonError;
      }
      return jsonData;
    },
    async blob() {
      return blobData ?? new Blob(["pdf"]);
    }
  };
}

describe("wardrobe api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ items: [] });
    requestApi.request.mockResolvedValue(createResponse());
    vi.stubGlobal("setTimeout", vi.fn((callback) => {
      callback();
      return 0;
    }));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:wardrobe-pdf"),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("fetchWardrobeItems dedupes in-flight requests per profileKey and force flag", async () => {
    const deferred = [];
    requestApi.requestJson.mockImplementation(() => new Promise((resolve) => {
      deferred.push(resolve);
    }));

    const first = fetchWardrobeItems({ profileKey: "profile-1" });
    const second = fetchWardrobeItems({ profileKey: "profile-1" });
    const forced = fetchWardrobeItems({ profileKey: "profile-1", force: true });

    expect(requestApi.requestJson).toHaveBeenCalledTimes(2);

    deferred[0]({ items: [{ id: "look-1" }] });
    deferred[1]({ items: [{ id: "look-1" }] });

    await expect(first).resolves.toEqual({ items: [{ id: "look-1" }] });
    await expect(second).resolves.toEqual({ items: [{ id: "look-1" }] });
    await expect(forced).resolves.toEqual({ items: [{ id: "look-1" }] });

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/wardrobe/items",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false })
      }
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/wardrobe/items",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      }
    );
  });

  test("downloadWardrobePdf polls pending responses, downloads blob, and revokes object url", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorMethods = { click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === "a") {
        element.click = anchorMethods.click;
        element.remove = anchorMethods.remove;
      }
      return element;
    });

    requestApi.request
      .mockResolvedValueOnce(createResponse({
        status: 202,
        ok: false,
        jsonData: { pollAfterMs: 25 }
      }))
      .mockResolvedValueOnce(createResponse({
        status: 200,
        ok: true,
        blobData: new Blob(["pdf-binary"], { type: "application/pdf" })
      }));

    await downloadWardrobePdf({ locale: "ru" });

    expect(requestApi.request).toHaveBeenCalledTimes(2);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 25);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorMethods.click).toHaveBeenCalledTimes(1);
    expect(anchorMethods.remove).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:wardrobe-pdf");
  });

  test("downloadWardrobePdf surfaces endpoint errors after polling parse fallback", async () => {
    requestApi.request.mockResolvedValue(createResponse({
      ok: false,
      status: 503,
      jsonError: new Error("invalid_json")
    }));

    await expect(downloadWardrobePdf({ locale: "en" })).rejects.toMatchObject({
      message: "request_failed_503",
      status: 503
    });
  });

  test("regenerateSelectedWardrobeItems polls until completion and returns payload", async () => {
    requestApi.request
      .mockResolvedValueOnce(createResponse({
        status: 202,
        ok: false,
        jsonData: { pollAfterMs: 10 }
      }))
      .mockResolvedValueOnce(createResponse({
        status: 200,
        ok: true,
        jsonData: { items: [{ id: "item-2" }], reasoning: "updated" }
      }));

    await expect(
      regenerateSelectedWardrobeItems({ itemUrls: ["https://example.com/item-1"] })
    ).resolves.toEqual({ items: [{ id: "item-2" }], reasoning: "updated" });

    expect(requestApi.request).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/wardrobe/items/regenerate-selected",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUrls: ["https://example.com/item-1"] })
      }
    );
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 10);
  });

  test("regenerateSelectedWardrobeItems propagates structured endpoint errors", async () => {
    requestApi.request.mockResolvedValue(createResponse({
      ok: false,
      status: 422,
      jsonData: { error: "invalid_payload", rejected: ["item-1"] }
    }));

    await expect(
      regenerateSelectedWardrobeItems({ itemUrls: ["https://example.com/item-1"] })
    ).rejects.toMatchObject({
      message: "invalid_payload",
      status: 422,
      data: { error: "invalid_payload", rejected: ["item-1"] }
    });
  });
});
