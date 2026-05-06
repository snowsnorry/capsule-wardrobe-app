import { beforeEach, describe, expect, test, vi } from "vitest";
import { downloadCapsulePdf } from "../api/capsules";
import {
  regenerateSelectedWardrobeItems,
  subscribeCapsuleEvents
} from "../api/wardrobe";
import {
  downloadWardrobePdf,
  regenerateSelectedItems,
  startCapsuleEventStream,
  stopCapsuleEventStream
} from "./wardrobeActions";
import { createActionContext } from "./testUtils";

vi.mock("../api/capsules", () => ({
  downloadCapsulePdf: vi.fn()
}));
vi.mock("../api/wardrobe", () => ({
  deleteOutfitSetImage: vi.fn(),
  generateOutfitSetImage: vi.fn(),
  regenerateCapsuleWardrobe: vi.fn(),
  regenerateSelectedWardrobeItems: vi.fn(),
  subscribeCapsuleEvents: vi.fn()
}));

describe("wardrobeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("downloadWardrobePdf toggles the PDF busy flag around the API call", async () => {
    vi.mocked(downloadCapsulePdf).mockResolvedValue(undefined);
    const context = createActionContext();

    await downloadWardrobePdf(context, "capsule-1");

    expect(context.setIsDownloadingWardrobePdf).toHaveBeenNthCalledWith(1, true);
    expect(downloadCapsulePdf).toHaveBeenCalledWith("capsule-1");
    expect(context.setIsDownloadingWardrobePdf).toHaveBeenLastCalledWith(false);
  });

  test("regenerateSelectedItems sends selected urls and subscribes to capsule events when pending", async () => {
    vi.mocked(regenerateSelectedWardrobeItems).mockResolvedValue({ status: "pending" });
    const context = createActionContext({
      profileItems: [
        { id: "top-1", url: "https://example.com/top-1" },
        { id: "bottom-1", url: "https://example.com/bottom-1" }
      ],
      selectedRegenerationUrls: ["https://example.com/top-1"]
    });

    await regenerateSelectedItems(context);

    expect(context.setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(context.setPartialRegenerationPendingUrls).toHaveBeenCalledWith(["https://example.com/top-1"]);
    expect(context.setIsPartialRegenerationLoading).toHaveBeenCalledWith(true);
    expect(regenerateSelectedWardrobeItems).toHaveBeenCalledWith({
      itemUrls: ["https://example.com/top-1"],
      capsuleId: "capsule-1"
    });
    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith("partial");
    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(expect.objectContaining({ capsuleId: "capsule-1" }));
  });

  test("startCapsuleEventStream subscribes and stopCapsuleEventStream aborts the stream", () => {
    vi.mocked(subscribeCapsuleEvents).mockReturnValue(new Promise(() => undefined));
    const context = createActionContext();

    startCapsuleEventStream(context, "capsule-1");
    const abortRef = context.capsuleEventsAbortRef as { current: AbortController | null };

    expect(subscribeCapsuleEvents).toHaveBeenCalledWith(expect.objectContaining({
      capsuleId: "capsule-1",
      signal: abortRef.current?.signal
    }));

    stopCapsuleEventStream(context);

    expect(abortRef.current).toBe(null);
  });
});
