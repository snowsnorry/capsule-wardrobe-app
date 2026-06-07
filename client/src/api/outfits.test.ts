import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import {
  createOutfit,
  deleteOutfit,
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchOutfitBootstrap,
  fetchRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  updateOutfitItems,
} from "./outfits";

type HeaderMap = Record<string, string>;
type MockResponse = Pick<Response, "blob" | "json" | "ok" | "status"> & {
  headers: Pick<Headers, "get">;
};

function createResponse({
  blobData = null,
  headers = {},
  jsonData = undefined,
  jsonError = null,
  ok = true,
  status = 200,
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

describe("outfits api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ ok: true });
    requestApi.request.mockResolvedValue(createResponse() as Response);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:outfit-pdf"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads outfit bootstrap, recent pages, search, and detail routes", async () => {
    await fetchOutfitBootstrap();
    await fetchRecentOutfits({ limit: 10, offset: 20 });
    await fetchRecentOutfits();
    await searchOutfits(" linen jacket ");
    await searchOutfits(" ");
    await fetchOutfit(" outfit 1 ");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/outfits/bootstrap",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/outfits/recent?limit=10&offset=20",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/outfits/recent",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/outfits/search?q=linen%20jacket",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      5,
      "https://api.example.test/outfits/search",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      6,
      "https://api.example.test/outfits/outfit%201",
      { credentials: "include" },
    );
  });

  test("writes outfit creation and mutation payloads through JSON requests", async () => {
    const items = [
      {
        key: "https://example.com/jacket",
        source: "catalog",
        item: { url: "https://example.com/jacket" },
      },
    ];

    await createOutfit({ name: " Weekend ", items });
    await createOutfit({ name: " ", items: [] });
    await updateOutfitItems("outfit/1", items);
    await saveOutfit("outfit-1");
    await revertOutfit("outfit-1");
    await renameOutfit("outfit-1", "Travel");
    await duplicateOutfit("outfit-1", "Travel copy");
    await duplicateOutfit("outfit-1");
    await selectOutfit("outfit-1");
    await deleteOutfit("outfit-1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/outfits",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: " Weekend ", items }),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/outfits",
      expect.objectContaining({
        body: JSON.stringify({ items: [] }),
      }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/outfits/outfit%2F1/items",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ items }),
      }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/outfits/outfit-1/save",
      { method: "POST", credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      5,
      "https://api.example.test/outfits/outfit-1/revert",
      { method: "POST", credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      6,
      "https://api.example.test/outfits/outfit-1/rename",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Travel" }),
      }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      7,
      "https://api.example.test/outfits/outfit-1/duplicate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Travel copy" }),
      }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      8,
      "https://api.example.test/outfits/outfit-1/duplicate",
      expect.objectContaining({ body: JSON.stringify({}) }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      9,
      "https://api.example.test/outfits/outfit-1/select",
      { method: "POST", credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      10,
      "https://api.example.test/outfits/outfit-1",
      { method: "DELETE", credentials: "include" },
    );
  });

  test("downloads outfit PDFs with RFC 5987 filenames and fallback filenames", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorMethods = { click: vi.fn(), remove: vi.fn() };
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === "a") {
        element.click = anchorMethods.click;
        element.remove = anchorMethods.remove;
        createdAnchors.push(element);
      }
      return element;
    });

    requestApi.request
      .mockResolvedValueOnce(
        createResponse({
          blobData: new Blob(["pdf"], { type: "application/pdf" }),
          headers: {
            "content-disposition": `attachment; filename="ignored.pdf"; filename*=UTF-8''${encodeURIComponent("Weekend edit.pdf")}`,
          },
        }) as Response,
      )
      .mockResolvedValueOnce(
        createResponse({
          headers: {
            "content-disposition": `attachment; filename*=UTF-8''%E0%A4%A; filename=plain.pdf`,
          },
        }) as Response,
      )
      .mockResolvedValueOnce(createResponse() as Response);

    await downloadOutfitPdf("outfit-1");
    await downloadOutfitPdf("outfit-2");
    await downloadOutfitPdf("outfit-3");

    expect(requestApi.request).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/outfits/outfit-1/pdf",
      { method: "POST", credentials: "include" },
    );
    expect(createdAnchors.map((anchor) => anchor.download)).toEqual([
      "Weekend edit.pdf",
      "plain.pdf",
      "capsule-wardrobe.pdf",
    ]);
    expect(anchorMethods.click).toHaveBeenCalledTimes(3);
    expect(anchorMethods.remove).toHaveBeenCalledTimes(3);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:outfit-pdf");
  });

  test("surfaces outfit PDF endpoint errors with parsed and fallback messages", async () => {
    requestApi.request
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 400,
          jsonData: { error: "empty_outfit" },
        }) as Response,
      )
      .mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 503,
          jsonError: new Error("invalid_json"),
        }) as Response,
      );

    await expect(downloadOutfitPdf("outfit-1")).rejects.toMatchObject({
      message: "empty_outfit",
      status: 400,
    });
    await expect(downloadOutfitPdf("outfit-1")).rejects.toMatchObject({
      message: "request_failed_503",
      status: 503,
    });
  });
});
