import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useCapsuleRouteSync } from "./useCapsuleRouteSync";
import { createTestCapsule } from "./testUtils";

const capsuleActions = vi.hoisted(() => ({
  createNewCapsule: vi.fn(),
  openCapsule: vi.fn(),
}));

vi.mock("./capsuleActions", () => capsuleActions);

function createOptions(overrides = {}) {
  return {
    activeCapsuleId: "",
    activeCapsuleMeta: null,
    appRoute: "capsule",
    capsuleRouteId: "",
    capsuleRouteMode: "empty",
    clearActiveCapsuleState: vi.fn(),
    getAppActionContext: vi.fn(() => ({})),
    hasUsableProfile: true,
    isContentOperationLoading: false,
    navigateCapsule: vi.fn(),
    pendingShareId: "",
    resolveErrorMessage: vi.fn((error: { message?: string } | null) =>
      error?.message ? `resolved:${error.message}` : "resolved",
    ),
    sessionInitialized: true,
    setStatus: vi.fn(),
    userEmail: "person@example.com",
    ...overrides,
  } as Parameters<typeof useCapsuleRouteSync>[0];
}

describe("useCapsuleRouteSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("clears stale capsule state on the empty capsule route without creating", () => {
    const clearActiveCapsuleState = vi.fn();

    renderHook(() =>
      useCapsuleRouteSync(
        createOptions({
          activeCapsuleId: "capsule-1",
          activeCapsuleMeta: createTestCapsule({ id: "capsule-1" }),
          clearActiveCapsuleState,
        }),
      ),
    );

    expect(clearActiveCapsuleState).toHaveBeenCalledTimes(1);
    expect(capsuleActions.createNewCapsule).not.toHaveBeenCalled();
    expect(capsuleActions.openCapsule).not.toHaveBeenCalled();
  });

  test("creates once on the new capsule route and replaces with the created capsule URL", async () => {
    const navigateCapsule = vi.fn();
    capsuleActions.createNewCapsule.mockResolvedValue(
      createTestCapsule({ id: "capsule-2" }),
    );

    const { rerender } = renderHook(
      (options: Parameters<typeof useCapsuleRouteSync>[0]) =>
        useCapsuleRouteSync(options),
      {
        initialProps: createOptions({
          capsuleRouteMode: "create",
          navigateCapsule,
        }),
      },
    );

    await waitFor(() => {
      expect(navigateCapsule).toHaveBeenCalledWith("capsule-2", {
        replace: true,
      });
    });
    rerender(createOptions({ capsuleRouteMode: "create", navigateCapsule }));
    expect(capsuleActions.createNewCapsule).toHaveBeenCalledTimes(1);
  });

  test("does not navigate when a create result resolves after leaving the create route", async () => {
    let resolveCreate: (capsule: unknown) => void = () => {};
    const navigateCapsule = vi.fn();
    capsuleActions.createNewCapsule.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { rerender } = renderHook(
      (options: Parameters<typeof useCapsuleRouteSync>[0]) =>
        useCapsuleRouteSync(options),
      {
        initialProps: createOptions({
          capsuleRouteMode: "create",
          navigateCapsule,
        }),
      },
    );

    rerender(createOptions({ capsuleRouteMode: "empty", navigateCapsule }));
    resolveCreate(createTestCapsule({ id: "capsule-2" }));

    await waitFor(() => {
      expect(capsuleActions.createNewCapsule).toHaveBeenCalledTimes(1);
    });
    expect(navigateCapsule).not.toHaveBeenCalled();
  });

  test("loads a capsule id from the route", async () => {
    capsuleActions.openCapsule.mockResolvedValue(undefined);
    const context = {};
    const getAppActionContext = vi.fn(() => context);

    renderHook(() =>
      useCapsuleRouteSync(
        createOptions({
          capsuleRouteId: "capsule-2",
          capsuleRouteMode: "open",
          getAppActionContext,
        }),
      ),
    );

    await waitFor(() => {
      expect(capsuleActions.openCapsule).toHaveBeenCalledWith(
        context,
        "capsule-2",
      );
    });
  });

  test("clears stale state and reports load errors for invalid capsule ids", async () => {
    const clearActiveCapsuleState = vi.fn();
    const setStatus = vi.fn();
    capsuleActions.openCapsule.mockRejectedValue(new Error("not_found"));

    renderHook(() =>
      useCapsuleRouteSync(
        createOptions({
          activeCapsuleId: "capsule-1",
          activeCapsuleMeta: createTestCapsule({ id: "capsule-1" }),
          capsuleRouteId: "missing",
          capsuleRouteMode: "open",
          clearActiveCapsuleState,
          setStatus,
        }),
      ),
    );

    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith({
        loading: false,
        error: "resolved:not_found",
        infoKey: "",
        infoParams: null,
      });
    });
    expect(clearActiveCapsuleState).toHaveBeenCalledTimes(2);
  });

  test("does not report open errors after leaving the open route", async () => {
    let rejectOpen: (error: unknown) => void = () => {};
    const setStatus = vi.fn();
    capsuleActions.openCapsule.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOpen = reject;
        }),
    );

    const { rerender } = renderHook(
      (options: Parameters<typeof useCapsuleRouteSync>[0]) =>
        useCapsuleRouteSync(options),
      {
        initialProps: createOptions({
          capsuleRouteId: "capsule-2",
          capsuleRouteMode: "open",
          setStatus,
        }),
      },
    );

    rerender(createOptions({ capsuleRouteMode: "empty", setStatus }));
    rejectOpen(new Error("not_found"));

    await waitFor(() => {
      expect(capsuleActions.openCapsule).toHaveBeenCalledTimes(1);
    });
    expect(setStatus).not.toHaveBeenCalled();
  });
});
