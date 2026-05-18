import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { updateProfileLocale } from "../api/auth";
import { useAppLifecycleEffects } from "./useAppLifecycleEffects";
import { createTestProfile } from "./testUtils";

vi.mock("../api/auth", () => ({
  updateProfileLocale: vi.fn(),
}));

function createAppState(overrides: Record<string, unknown> = {}) {
  return {
    capsuleEventsAbortRef: { current: null },
    hasProfile: true,
    isMountedRef: { current: false },
    partialRegenerationPendingUrls: [],
    pendingNotificationKindRef: { current: "full" },
    pendingRegenerationUrlsRef: { current: [] },
    profileCreated: false,
    sessionInitialized: true,
    setSettingsProfile: vi.fn(),
    settingsProfile: createTestProfile({ locale: "en" }),
    user: { email: "person@example.com" },
    ...overrides,
  };
}

describe("useAppLifecycleEffects", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("tracks mounted state, pending regeneration urls, and aborts streams on cleanup", () => {
    const abort = vi.fn();
    const appState = createAppState({
      capsuleEventsAbortRef: { current: { abort } },
      partialRegenerationPendingUrls: ["https://example.com/top"],
    });

    const { unmount } = renderHook(() =>
      useAppLifecycleEffects({ appState: appState as never, locale: "en" }),
    );

    expect(appState.isMountedRef.current).toBe(true);
    expect(appState.pendingRegenerationUrlsRef.current).toEqual([
      "https://example.com/top",
    ]);

    unmount();

    expect(abort).toHaveBeenCalledTimes(1);
    expect(appState.capsuleEventsAbortRef.current).toBeNull();
    expect(appState.pendingNotificationKindRef.current).toBe("");
    expect(appState.isMountedRef.current).toBe(false);
  });

  test("persists a locale change for initialized signed-in profiles", async () => {
    vi.mocked(updateProfileLocale).mockResolvedValue({});
    const setSettingsProfile = vi.fn((updater) => {
      expect(updater(createTestProfile({ locale: "en" }))).toEqual(
        expect.objectContaining({ locale: "ru" }),
      );
    });
    const appState = createAppState({ setSettingsProfile });

    renderHook(() =>
      useAppLifecycleEffects({ appState: appState as never, locale: "ru" }),
    );

    await waitFor(() => {
      expect(updateProfileLocale).toHaveBeenCalledWith("ru");
    });
    expect(setSettingsProfile).toHaveBeenCalledWith(expect.any(Function));
  });
});
