import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fetchEventSourceApi = vi.hoisted(() => ({
  fetchEventSource: vi.fn()
}));

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn()
}));

vi.mock("@microsoft/fetch-event-source", () => fetchEventSourceApi);
vi.mock("./request.js", () => requestApi);
vi.mock("./config.js", () => ({
  API_BASE_URL: "https://api.example.test"
}));

import { downloadCapsulePdf } from "./capsules.js";
import {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
  subscribeCapsuleEvents
} from "./wardrobe.js";

function createResponse({
  ok = true,
  status = 200,
  jsonData = undefined,
  jsonError = null,
  blobData = null,
  headers = {}
} = {}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      }
    },
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
    fetchEventSourceApi.fetchEventSource.mockReset();
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ items: [] });
    requestApi.request.mockResolvedValue(createResponse());
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:wardrobe-pdf"),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("subscribeCapsuleEvents delegates to fetch-event-source and parses snapshot payloads", async () => {
    const onMessage = vi.fn();
    fetchEventSourceApi.fetchEventSource.mockImplementation(async (_url, options) => {
      options.onmessage({
        event: "snapshot",
        data: JSON.stringify({ status: "ready", items: [{ id: "look-1" }] })
      });
    });

    await subscribeCapsuleEvents({ capsuleId: "capsule-1", onMessage });

    expect(fetchEventSourceApi.fetchEventSource).toHaveBeenCalledTimes(1);
    expect(fetchEventSourceApi.fetchEventSource).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/events",
      expect.objectContaining({
        credentials: "include",
        openWhenHidden: true
      })
    );
    expect(onMessage).toHaveBeenCalledWith({
      event: "snapshot",
      data: { status: "ready", items: [{ id: "look-1" }] }
    });
  });

  test("regenerateCapsuleWardrobe posts to the capsule-centric route", async () => {
    await regenerateCapsuleWardrobe({ capsuleId: "capsule-1" });

    expect(requestApi.requestJson).toHaveBeenCalledWith("https://api.example.test/capsules/capsule-1/regenerate", {
      method: "POST",
      credentials: "include"
    });
  });

  test("downloadCapsulePdf downloads blob and revokes object url", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchorMethods = { click: vi.fn(), remove: vi.fn() };
    let createdAnchor = null;
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (String(tagName).toLowerCase() === "a") {
        element.click = anchorMethods.click;
        element.remove = anchorMethods.remove;
        createdAnchor = element;
      }
      return element;
    });

    requestApi.request.mockResolvedValueOnce(createResponse({
      status: 200,
      ok: true,
      blobData: new Blob(["pdf-binary"], { type: "application/pdf" }),
      headers: {
        "content-disposition": `attachment; filename="Spring-edit.pdf"; filename*=UTF-8''${encodeURIComponent("Spring edit.pdf")}`
      }
    }));

    await downloadCapsulePdf("capsule-1");

    expect(requestApi.request).toHaveBeenCalledTimes(1);
    expect(requestApi.request).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/pdf",
      {
        method: "POST",
        credentials: "include"
      }
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorMethods.click).toHaveBeenCalledTimes(1);
    expect(anchorMethods.remove).toHaveBeenCalledTimes(1);
    expect(createdAnchor?.download).toBe("Spring edit.pdf");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:wardrobe-pdf");
  });

  test("downloadCapsulePdf surfaces endpoint errors after parse fallback", async () => {
    requestApi.request.mockResolvedValue(createResponse({
      ok: false,
      status: 503,
      jsonError: new Error("invalid_json")
    }));

    await expect(downloadCapsulePdf("capsule-1")).rejects.toMatchObject({
      message: "request_failed_503",
      status: 503
    });
  });

  test("regenerateSelectedWardrobeItems posts once and returns payload", async () => {
    requestApi.requestJson.mockResolvedValueOnce({
      items: [{ id: "item-2" }],
      reasoning: "updated"
    });

    await expect(
      regenerateSelectedWardrobeItems({ itemUrls: ["https://example.com/item-1"], capsuleId: "capsule-1" })
    ).resolves.toEqual({ items: [{ id: "item-2" }], reasoning: "updated" });

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/regenerate-selected",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUrls: ["https://example.com/item-1"] })
      }
    );
  });

  test("regenerateSelectedWardrobeItems propagates structured endpoint errors", async () => {
    requestApi.requestJson.mockRejectedValue(Object.assign(new Error("invalid_payload"), {
      status: 422,
      data: { error: "invalid_payload", rejected: ["item-1"] }
    }));

    await expect(
      regenerateSelectedWardrobeItems({ itemUrls: ["https://example.com/item-1"], capsuleId: "capsule-1" })
    ).rejects.toMatchObject({
      message: "invalid_payload",
      status: 422,
      data: { error: "invalid_payload", rejected: ["item-1"] }
    });
  });

  test("generateOutfitSetImage posts to the outfit-set image route", async () => {
    requestApi.requestJson.mockResolvedValueOnce({ ok: true, status: "pending" });

    await expect(generateOutfitSetImage({ capsuleId: "capsule-1", setIndex: 2 })).resolves.toEqual({
      ok: true,
      status: "pending"
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/outfit-sets/2/image",
      {
        method: "POST",
        credentials: "include"
      }
    );
  });

  test("deleteOutfitSetImage deletes through the outfit-set image route", async () => {
    requestApi.requestJson.mockResolvedValueOnce({ ok: true, status: "ready" });

    await expect(deleteOutfitSetImage({ capsuleId: "capsule-1", setIndex: 2 })).resolves.toEqual({
      ok: true,
      status: "ready"
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/outfit-sets/2/image",
      {
        method: "DELETE",
        credentials: "include"
      }
    );
  });
});
