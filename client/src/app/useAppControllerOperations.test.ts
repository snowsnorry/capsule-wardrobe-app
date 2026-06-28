import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppControllerOperations } from "./useAppControllerOperations";

function buildOperationInput() {
  const appState = {
    pendingNotificationKindRef: { current: "" },
    settingsProfile: { llm: "openai" },
    setActiveOutfitId: vi.fn(),
    setActiveOutfitMeta: vi.fn(),
    setOutfitList: vi.fn(),
    setOutfitPagination: vi.fn(),
  };
  const notifications = {
    closeNotificationPrompt: vi.fn(),
    openPendingNotificationPrompt: vi.fn(),
  };

  return {
    appState,
    input: {
      appState,
      locale: "en",
      navigation: {},
      notifications,
      profileOptions: { applyWardrobeFilters: vi.fn() },
      resolveErrorMessage: (error) => error?.message || "error",
      setLocale: vi.fn(),
      shareRoute: {},
      t: (key) => key,
    },
    notifications,
  };
}

describe("useAppControllerOperations", () => {
  test("clears active outfit state and applies provided list metadata", () => {
    const { appState, input } = buildOperationInput();
    const { result } = renderHook(() =>
      useAppControllerOperations(input as never),
    );
    const outfits = [{ id: "outfit-1", name: "Outfit" }];
    const pagination = {
      hasMore: false,
      limit: 10,
      nextOffset: null,
      offset: 0,
      total: 1,
    };

    result.current.clearActiveOutfitState({ outfits, pagination });

    expect(appState.setActiveOutfitId).toHaveBeenCalledWith("");
    expect(appState.setActiveOutfitMeta).toHaveBeenCalledWith(null);
    expect(appState.setOutfitList).toHaveBeenCalledWith(outfits);
    expect(appState.setOutfitPagination).toHaveBeenCalledWith(pagination);
  });

  test("starts the pending notification flow with the current default LLM", () => {
    const { appState, input, notifications } = buildOperationInput();
    const { result } = renderHook(() =>
      useAppControllerOperations(input as never),
    );

    result.current.startPendingNotificationFlow("capsuleReportGenerate");

    expect(appState.pendingNotificationKindRef.current).toBe(
      "capsuleReportGenerate",
    );
    expect(notifications.openPendingNotificationPrompt).toHaveBeenCalledWith(
      "openai",
    );
  });
});
