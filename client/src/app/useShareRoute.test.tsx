import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fetchSharedCapsule } from "../api/capsules";
import { useShareRoute } from "./useShareRoute";

vi.mock("../api/capsules", () => ({
  fetchSharedCapsule: vi.fn(),
}));

function Harness({
  hasProfile = true,
  pendingShareId = "share-1",
  profileCreated = false,
  sessionInitialized = true,
  user = { email: "person@example.com" },
}: Partial<Parameters<typeof useShareRoute>[0]> = {}) {
  const result = useShareRoute({
    clearNavigationShareRoute: vi.fn(),
    hasProfile,
    isMountedRef: { current: true },
    pendingShareId,
    profileCreated,
    resolveErrorMessage: (error) => error?.message || "resolved error",
    sessionInitialized,
    setStatus: vi.fn((status) => {
      window.sessionStorage.setItem("status-error", status.error);
    }),
    user,
  });

  return (
    <div>
      <div data-testid="dialog-open">{String(result.isShareDialogOpen)}</div>
      <div data-testid="share-name">{result.shareMetadata?.name || ""}</div>
      <div data-testid="loading">{String(result.isShareLoading)}</div>
    </div>
  );
}

describe("useShareRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("loads share metadata after session and profile are ready", async () => {
    vi.mocked(fetchSharedCapsule).mockResolvedValue({
      id: "share-1",
      name: "Shared edit",
      expiresAt: new Date(60_000).toISOString(),
    });

    render(<Harness />);

    await waitFor(() => {
      expect(fetchSharedCapsule).toHaveBeenCalledWith("share-1");
    });
    await waitFor(() => {
      expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
      expect(screen.getByTestId("share-name")).toHaveTextContent("Shared edit");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(fetchSharedCapsule).toHaveBeenCalledTimes(1);
  });

  test("does not load share metadata before user/profile readiness", () => {
    render(<Harness user={null} />);

    expect(fetchSharedCapsule).not.toHaveBeenCalled();
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });

  test("sets an error and clears route state when share metadata is unavailable", async () => {
    vi.mocked(fetchSharedCapsule).mockRejectedValue(
      new Error("shared_capsule_unavailable"),
    );

    render(<Harness />);

    await waitFor(() => {
      expect(window.sessionStorage.getItem("status-error")).toBe(
        "shared_capsule_unavailable",
      );
    });
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("false");
  });
});
