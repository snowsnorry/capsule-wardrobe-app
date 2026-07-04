import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { fetchAppBootstrap } from "../api/appBootstrap";
import { updateProfileLocale } from "../api/auth";
import { notifyPersonalItemsChanged } from "./personalItemsCount";
import { useAppLifecycleEffects } from "./useAppLifecycleEffects";
import { createTestProfile } from "./testUtils";

vi.mock("../api/appBootstrap", () => ({
  fetchAppBootstrap: vi.fn(),
}));
vi.mock("../api/auth", () => ({
  updateProfileLocale: vi.fn(),
}));

function createAppState(overrides: Record<string, unknown> = {}) {
  return {
    activeCapsuleId: "capsule-1",
    activeCapsuleIdRef: { current: "" },
    activeOutfitId: "outfit-1",
    activeOutfitIdRef: { current: "" },
    capsuleEventsAbortRef: { current: null },
    hasProfile: true,
    isMountedRef: { current: false },
    partialRegenerationPendingUrls: [],
    pendingNotificationKindRef: { current: "full" },
    pendingRegenerationUrlsRef: { current: [] },
    profileCreated: false,
    sessionInitialized: true,
    setPersonalItemsCount: vi.fn(),
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
    expect(appState.activeCapsuleIdRef.current).toBe("capsule-1");
    expect(appState.activeOutfitIdRef.current).toBe("outfit-1");
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

  test("refreshes personal items count from app bootstrap after wardrobe changes", async () => {
    vi.mocked(fetchAppBootstrap).mockResolvedValue({ wardrobeCount: 4 });
    const setPersonalItemsCount = vi.fn();
    const appState = createAppState({ setPersonalItemsCount });

    renderHook(() =>
      useAppLifecycleEffects({ appState: appState as never, locale: "en" }),
    );

    notifyPersonalItemsChanged();

    await waitFor(() => {
      expect(fetchAppBootstrap).toHaveBeenCalledTimes(1);
    });
    expect(setPersonalItemsCount).toHaveBeenCalledWith(4);
  });

  test("keeps personal items count unknown when app bootstrap count is null", async () => {
    vi.mocked(fetchAppBootstrap).mockResolvedValue({ wardrobeCount: null });
    const setPersonalItemsCount = vi.fn();
    const appState = createAppState({ setPersonalItemsCount });

    renderHook(() =>
      useAppLifecycleEffects({ appState: appState as never, locale: "en" }),
    );

    notifyPersonalItemsChanged();

    await waitFor(() => {
      expect(setPersonalItemsCount).toHaveBeenCalledWith(null);
    });
  });
});
