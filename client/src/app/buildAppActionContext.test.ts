import { describe, expect, test, vi } from "vitest";
import { buildAppActionContext } from "./buildAppActionContext";
import { createActionContext } from "./testUtils";

describe("buildAppActionContext", () => {
  test("maps app state, operations, and logout handler into an action context", async () => {
    const expected = createActionContext();
    const signOut = vi.fn(() => Promise.resolve());
    const appState = {
      ...expected,
      setIsShareLoading: vi.fn(),
      setLocale: vi.fn(),
      shareMetadata: { id: "state-share" },
    };

    const context = buildAppActionContext({
      appState,
      applyCapsuleState: expected.applyCapsuleState,
      applyWardrobeSnapshot: expected.applyWardrobeSnapshot,
      bootstrapCapsules: expected.bootstrapCapsules,
      buildCurrentDraftSnapshot: expected.buildCurrentDraftSnapshot,
      clearShareRoute: expected.clearShareRoute,
      closeNotificationPrompt: expected.closeNotificationPrompt,
      handlers: { signOut },
      locale: "ru",
      pendingShareId: "share-2",
      resolveErrorMessage: expected.resolveErrorMessage,
      setIsShareLoading: expected.setIsShareLoading,
      setLocale: expected.setLocale,
      shareMetadata: { id: "share-2" },
      startCapsuleEventStream: expected.startCapsuleEventStream,
      startPendingNotificationFlow: expected.startPendingNotificationFlow,
      t: expected.t,
    } as never);

    expect(context.activeCapsuleId).toBe("capsule-1");
    expect(context.locale).toBe("ru");
    expect(context.pendingShareId).toBe("share-2");
    expect(context.setIsShareLoading).toBe(expected.setIsShareLoading);
    expect(context.setLocale).toBe(expected.setLocale);
    expect(context.shareMetadata).toEqual({ id: "share-2" });

    await context.handleLogout();

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
