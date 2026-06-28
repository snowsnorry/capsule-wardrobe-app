import { describe, expect, test, vi } from "vitest";
import { buildDefaultActionContext } from "./buildDefaultActionContext";
import { createActionContext } from "./testUtils";

describe("buildDefaultActionContext", () => {
  test("builds a safe initial action context before app handlers are connected", async () => {
    const base = createActionContext();
    const appState = {
      ...base,
      setIsShareLoading: vi.fn(),
      setLocale: vi.fn(),
    };
    const context = buildDefaultActionContext({
      appState,
      locale: "en",
      notifications: {
        closeNotificationPrompt: vi.fn(),
      },
      operations: {
        applyCapsuleState: base.applyCapsuleState,
        applyWardrobeSnapshot: base.applyWardrobeSnapshot,
        bootstrapCapsules: base.bootstrapCapsules,
        buildCurrentDraftSnapshot: base.buildCurrentDraftSnapshot,
        startCapsuleEventStream: base.startCapsuleEventStream,
        startPendingNotificationFlow: base.startPendingNotificationFlow,
      },
      resolveErrorMessage: base.resolveErrorMessage,
      setLocale: base.setLocale,
      shareRoute: {
        clearShareRoute: base.clearShareRoute,
        setIsShareLoading: base.setIsShareLoading,
        shareMetadata: { id: "share-1" },
      },
      t: base.t,
    } as never);

    expect(context.getActiveCapsuleId()).toBe("capsule-1");
    const waitForJobCompletion = context.waitForJobCompletion as (
      jobId: string,
    ) => Promise<unknown>;
    await expect(waitForJobCompletion("job-1")).rejects.toThrow(
      "job_tracker_unavailable",
    );
  });
});
