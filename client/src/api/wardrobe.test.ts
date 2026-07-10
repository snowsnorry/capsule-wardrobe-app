import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fetchEventSourceApi = vi.hoisted(() => ({
  fetchEventSource: vi.fn(),
}));

const requestApi = vi.hoisted(() => ({
  request: vi.fn(),
  requestJson: vi.fn(),
}));

vi.mock("@microsoft/fetch-event-source", () => fetchEventSourceApi);
vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import { downloadCapsulePdf } from "./capsules";
import {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
} from "./wardrobe";

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

function createJobResponse(kind = "capsuleGenerate") {
  return {
    ok: true,
    job: {
      id: "job-1",
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

describe("wardrobe api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchEventSourceApi.fetchEventSource.mockReset();
    requestApi.request.mockReset();
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({ items: [] });
    requestApi.request.mockResolvedValue(createResponse() as Response);
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:wardrobe-pdf"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("regenerateCapsuleWardrobe posts to the capsule-centric route", async () => {
    requestApi.requestJson.mockResolvedValueOnce(createJobResponse());

    await expect(
      regenerateCapsuleWardrobe({ capsuleId: "capsule-1" }),
    ).resolves.toEqual(createJobResponse());

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/regenerate",
      {
        method: "POST",
        credentials: "include",
      },
    );
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

    requestApi.request.mockResolvedValueOnce(
      createResponse({
        status: 200,
        ok: true,
        blobData: new Blob(["pdf-binary"], { type: "application/pdf" }),
        headers: {
          "content-disposition": `attachment; filename="Spring-edit.pdf"; filename*=UTF-8''${encodeURIComponent("Spring edit.pdf")}`,
        },
      }) as Response,
    );

    await downloadCapsulePdf("capsule-1");

    expect(requestApi.request).toHaveBeenCalledTimes(1);
    expect(requestApi.request).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/pdf",
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorMethods.click).toHaveBeenCalledTimes(1);
    expect(anchorMethods.remove).toHaveBeenCalledTimes(1);
    expect(createdAnchor?.download).toBe("Spring edit.pdf");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:wardrobe-pdf");
  });

  test("downloadCapsulePdf surfaces endpoint errors after parse fallback", async () => {
    requestApi.request.mockResolvedValue(
      createResponse({
        ok: false,
        status: 503,
        jsonError: new Error("invalid_json"),
      }) as Response,
    );

    await expect(downloadCapsulePdf("capsule-1")).rejects.toMatchObject({
      message: "request_failed_503",
      status: 503,
    });
  });

  test("regenerateSelectedWardrobeItems posts once and returns payload", async () => {
    requestApi.requestJson.mockResolvedValueOnce(
      createJobResponse("capsuleRegenerateSelected"),
    );

    await expect(
      regenerateSelectedWardrobeItems({
        itemUrls: ["https://example.com/item-1"],
        capsuleId: "capsule-1",
      }),
    ).resolves.toEqual(createJobResponse("capsuleRegenerateSelected"));

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules/capsule-1/regenerate-selected",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemUrls: ["https://example.com/item-1"] }),
      },
    );
  });

  test("regenerateSelectedWardrobeItems propagates structured endpoint errors", async () => {
    requestApi.requestJson.mockRejectedValue(
      Object.assign(new Error("invalid_payload"), {
        status: 422,
        data: { error: "invalid_payload", rejected: ["item-1"] },
      }),
    );

    await expect(
      regenerateSelectedWardrobeItems({
        itemUrls: ["https://example.com/item-1"],
        capsuleId: "capsule-1",
      }),
    ).rejects.toMatchObject({
      message: "invalid_payload",
      status: 422,
      data: { error: "invalid_payload", rejected: ["item-1"] },
    });
  });

  test("generateOutfitSetImage posts to the outfit-set image route", async () => {
    requestApi.requestJson.mockResolvedValueOnce({
      ok: true,
      status: "pending",
    });

    await expect(
      generateOutfitSetImage({ capsuleId: "capsule-1", setIndex: 2 }),
    ).resolves.toEqual({
      ok: true,
      status: "pending",
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/outfit-sets/2/image",
      {
        method: "POST",
        credentials: "include",
      },
    );
  });

  test("image helpers normalize blank capsule ids and string set indexes", async () => {
    await generateOutfitSetImage({ capsuleId: " ", setIndex: "3" });
    await deleteOutfitSetImage({ setIndex: undefined });

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/capsules//outfit-sets/3/image",
      expect.objectContaining({ method: "POST" }),
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/capsules//outfit-sets/NaN/image",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("deleteOutfitSetImage deletes through the outfit-set image route", async () => {
    requestApi.requestJson.mockResolvedValueOnce({ ok: true, status: "ready" });

    await expect(
      deleteOutfitSetImage({ capsuleId: "capsule-1", setIndex: 2 }),
    ).resolves.toEqual({
      ok: true,
      status: "ready",
    });

    expect(requestApi.requestJson).toHaveBeenCalledWith(
      "https://api.example.test/capsules/capsule-1/outfit-sets/2/image",
      {
        method: "DELETE",
        credentials: "include",
      },
    );
  });
});
