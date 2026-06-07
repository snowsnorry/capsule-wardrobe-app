import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { createNewOutfit, openOutfit } from "./outfitActions";
import { useOutfitRouteSync } from "./useOutfitRouteSync";
import type { AppActionContext } from "./actionContext";
import type {
  AppRoute,
  OutfitMeta,
  OutfitRouteMode,
  StatusState,
} from "./appTypes";

vi.mock("./outfitActions", () => ({
  createNewOutfit: vi.fn(),
  openOutfit: vi.fn(),
}));

type HarnessProps = {
  activeOutfitId?: string;
  activeOutfitMeta?: OutfitMeta | null;
  appRoute?: AppRoute;
  clearActiveOutfitState?: () => void;
  getAppActionContext?: () => AppActionContext;
  hasUsableProfile?: boolean;
  isContentOperationLoading?: boolean;
  navigateOutfit?: (outfitId: string, options?: { replace?: boolean }) => void;
  outfitRouteId?: string;
  outfitRouteMode?: OutfitRouteMode;
  resolveErrorMessage?: (
    error: { message?: string } | null | undefined,
  ) => string;
  sessionInitialized?: boolean;
  setStatus?: (status: StatusState) => void;
  userEmail?: string;
};

const defaultContext = {};

function Harness({
  activeOutfitId = "",
  activeOutfitMeta = null,
  appRoute = "outfit",
  clearActiveOutfitState = vi.fn(),
  getAppActionContext = () => defaultContext,
  hasUsableProfile = true,
  isContentOperationLoading = false,
  navigateOutfit = vi.fn(),
  outfitRouteId = "",
  outfitRouteMode = "empty",
  resolveErrorMessage = (error) => error?.message || "resolved error",
  sessionInitialized = true,
  setStatus = vi.fn(),
  userEmail = "person@example.com",
}: HarnessProps) {
  useOutfitRouteSync({
    activeOutfitId,
    activeOutfitMeta,
    appRoute,
    clearActiveOutfitState,
    getAppActionContext,
    hasUsableProfile,
    isContentOperationLoading,
    navigateOutfit,
    outfitRouteId,
    outfitRouteMode,
    resolveErrorMessage,
    sessionInitialized,
    setStatus,
    userEmail,
  });
  return null;
}

describe("useOutfitRouteSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(openOutfit).mockResolvedValue(undefined);
    vi.mocked(createNewOutfit).mockResolvedValue({ id: "created-outfit" });
  });

  afterEach(() => {
    cleanup();
  });

  test("opens route-matched outfits and skips already active outfits", async () => {
    const clearActiveOutfitState = vi.fn();
    const getAppActionContext = vi.fn(() => defaultContext);

    const { rerender } = render(
      <Harness
        outfitRouteMode="open"
        outfitRouteId=" outfit-1 "
        clearActiveOutfitState={clearActiveOutfitState}
        getAppActionContext={getAppActionContext}
      />,
    );

    await waitFor(() =>
      expect(openOutfit).toHaveBeenCalledWith(defaultContext, "outfit-1"),
    );
    expect(clearActiveOutfitState).toHaveBeenCalledTimes(1);

    rerender(
      <Harness
        activeOutfitId="outfit-1"
        activeOutfitMeta={{ id: "outfit-1" }}
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );

    expect(openOutfit).toHaveBeenCalledTimes(1);
  });

  test("reports open failures once for the current route key", async () => {
    vi.mocked(openOutfit).mockRejectedValueOnce(new Error("not_found"));
    const clearActiveOutfitState = vi.fn();
    const setStatus = vi.fn();
    const { rerender } = render(
      <Harness
        outfitRouteMode="open"
        outfitRouteId="missing"
        clearActiveOutfitState={clearActiveOutfitState}
        setStatus={setStatus}
      />,
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        loading: false,
        error: "not_found",
        infoKey: "",
        infoParams: null,
      }),
    );

    rerender(
      <Harness
        outfitRouteMode="open"
        outfitRouteId="missing"
        clearActiveOutfitState={clearActiveOutfitState}
        setStatus={setStatus}
      />,
    );

    expect(openOutfit).toHaveBeenCalledTimes(1);
    expect(clearActiveOutfitState).toHaveBeenCalledTimes(2);
  });

  test("creates an outfit from create routes and replaces the URL", async () => {
    const clearActiveOutfitState = vi.fn();
    const navigateOutfit = vi.fn();
    const { rerender } = render(
      <Harness
        outfitRouteMode="create"
        clearActiveOutfitState={clearActiveOutfitState}
        navigateOutfit={navigateOutfit}
      />,
    );

    await waitFor(() =>
      expect(navigateOutfit).toHaveBeenCalledWith("created-outfit", {
        replace: true,
      }),
    );
    expect(createNewOutfit).toHaveBeenCalledTimes(1);

    rerender(
      <Harness
        outfitRouteMode="create"
        clearActiveOutfitState={clearActiveOutfitState}
        navigateOutfit={navigateOutfit}
      />,
    );

    expect(createNewOutfit).toHaveBeenCalledTimes(1);
  });

  test("reports create failures and allows retry after visiting the empty route", async () => {
    vi.mocked(createNewOutfit)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ id: "" })
      .mockResolvedValueOnce({ id: "retry-outfit" });
    const clearActiveOutfitState = vi.fn();
    const setStatus = vi.fn();
    const navigateOutfit = vi.fn();
    const { rerender } = render(
      <Harness
        outfitRouteMode="create"
        clearActiveOutfitState={clearActiveOutfitState}
        navigateOutfit={navigateOutfit}
        setStatus={setStatus}
      />,
    );

    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        loading: false,
        error: "network",
        infoKey: "",
        infoParams: null,
      }),
    );

    rerender(
      <Harness
        activeOutfitId="outfit-1"
        activeOutfitMeta={{ id: "outfit-1" }}
        outfitRouteMode="empty"
        clearActiveOutfitState={clearActiveOutfitState}
        navigateOutfit={navigateOutfit}
        setStatus={setStatus}
      />,
    );
    expect(clearActiveOutfitState).toHaveBeenLastCalledWith();

    rerender(
      <Harness
        outfitRouteMode="create"
        clearActiveOutfitState={clearActiveOutfitState}
        navigateOutfit={navigateOutfit}
        setStatus={setStatus}
      />,
    );

    await waitFor(() => expect(createNewOutfit).toHaveBeenCalledTimes(2));
    expect(navigateOutfit).not.toHaveBeenCalled();
  });

  test("does not sync until session, profile, route, user, and loading gates allow it", () => {
    const clearActiveOutfitState = vi.fn();
    const { rerender } = render(
      <Harness
        sessionInitialized={false}
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );
    rerender(
      <Harness
        userEmail=""
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );
    rerender(
      <Harness
        hasUsableProfile={false}
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );
    rerender(
      <Harness
        appRoute="explore"
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );
    rerender(
      <Harness
        isContentOperationLoading
        outfitRouteMode="open"
        outfitRouteId="outfit-1"
        clearActiveOutfitState={clearActiveOutfitState}
      />,
    );

    expect(openOutfit).not.toHaveBeenCalled();
    expect(clearActiveOutfitState).not.toHaveBeenCalled();
  });
});
