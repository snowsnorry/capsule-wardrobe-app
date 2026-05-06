import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { fetchCurrentUser, fetchProfileStatus } from "../api/auth";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { createTestProfile } from "./testUtils";

vi.mock("../api/auth", () => ({
  fetchCurrentUser: vi.fn(),
  fetchProfileStatus: vi.fn()
}));

function Harness({ options }: { options: Parameters<typeof useSessionBootstrap>[0] }) {
  useSessionBootstrap(options);
  return <div />;
}

function createOptions(overrides: Partial<Parameters<typeof useSessionBootstrap>[0]> = {}) {
  return {
    bootstrapCapsules: vi.fn(async () => createTestProfile()),
    ensureOptionsLoaded: vi.fn(async () => undefined),
    preloadOnboardingOptions: vi.fn(async () => undefined),
    setHasProfile: vi.fn(),
    setIsCheckingSession: vi.fn(),
    setProfileCreated: vi.fn(),
    setSessionInitialized: vi.fn(),
    setSettingsProfile: vi.fn(),
    setUser: vi.fn(),
    ...overrides
  };
}

describe("useSessionBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("bootstraps an existing profile with options and capsules", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({ user: { email: "person@example.com" } });
    vi.mocked(fetchProfileStatus).mockResolvedValue({ hasProfile: true });
    const options = createOptions();

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.setSessionInitialized).toHaveBeenCalledWith(true);
    });
    expect(options.setUser).toHaveBeenCalledWith({ email: "person@example.com" });
    expect(options.setHasProfile).toHaveBeenCalledWith(true);
    expect(options.ensureOptionsLoaded).toHaveBeenCalled();
    expect(options.bootstrapCapsules).toHaveBeenCalledWith("person@example.com");
    expect(options.preloadOnboardingOptions).not.toHaveBeenCalled();
  });

  test("preloads onboarding options for users without a profile", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({ user: { email: "person@example.com" } });
    vi.mocked(fetchProfileStatus).mockResolvedValue({ hasProfile: false });
    const options = createOptions();

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.preloadOnboardingOptions).toHaveBeenCalled();
    });
    expect(options.setHasProfile).toHaveBeenCalledWith(false);
    expect(options.setProfileCreated).toHaveBeenCalledWith(false);
    expect(options.ensureOptionsLoaded).not.toHaveBeenCalled();
    expect(options.bootstrapCapsules).not.toHaveBeenCalled();
  });

  test("falls back to signed-out state when current session lookup fails", async () => {
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error("unauthorized"));
    const options = createOptions();

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.setSessionInitialized).toHaveBeenCalledWith(true);
    });
    expect(options.setUser).toHaveBeenCalledWith(null);
    expect(options.setHasProfile).toHaveBeenCalledWith(false);
    expect(options.setSettingsProfile).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5"
    }));
    expect(fetchProfileStatus).not.toHaveBeenCalled();
  });
});
