import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { fetchCurrentUser, initializeProfile } from "../api/auth";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { createTestProfile } from "./testUtils";

vi.mock("../api/auth", () => ({
  fetchCurrentUser: vi.fn(),
  initializeProfile: vi.fn(),
}));

const mainScreenLoader = vi.hoisted(() => ({
  preloadMainScreen: vi.fn(),
  shouldPreloadMainScreenForCurrentPath: vi.fn(() => true),
}));

vi.mock("./mainScreenLoader", () => mainScreenLoader);

function Harness({
  options,
}: {
  options: Parameters<typeof useSessionBootstrap>[0];
}) {
  useSessionBootstrap(options);
  return <div />;
}

function createOptions(
  overrides: Partial<Parameters<typeof useSessionBootstrap>[0]> = {},
) {
  return {
    bootstrapCapsules: vi.fn(async () => ({
      ...createTestProfile(),
      hasProfile: true,
    })),
    ensureOptionsLoaded: vi.fn(async () => undefined),
    locale: "en",
    setHasProfile: vi.fn(),
    setIsCheckingSession: vi.fn(),
    setProfileCreated: vi.fn(),
    setSessionInitialized: vi.fn(),
    setSettingsProfile: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  };
}

describe("useSessionBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainScreenLoader.shouldPreloadMainScreenForCurrentPath.mockReturnValue(
      true,
    );
  });

  afterEach(() => {
    cleanup();
  });

  test("bootstraps an existing profile with options and capsules", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      user: { email: "person@example.com" },
    });
    const options = createOptions();

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.setSessionInitialized).toHaveBeenCalledWith(true);
    });
    expect(options.setUser).toHaveBeenCalledWith({
      email: "person@example.com",
    });
    expect(options.setHasProfile).toHaveBeenCalledWith(true);
    expect(options.ensureOptionsLoaded).toHaveBeenCalled();
    expect(options.bootstrapCapsules).toHaveBeenCalledWith(
      "person@example.com",
    );
    expect(mainScreenLoader.preloadMainScreen).toHaveBeenCalledTimes(1);
  });

  test("initializes a profile for users without one", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      user: { email: "person@example.com" },
    });
    vi.mocked(initializeProfile).mockResolvedValue({
      profile: createTestProfile({ locale: "en" }),
    });
    const options = createOptions({
      bootstrapCapsules: vi.fn(async () => ({
        ...createTestProfile(),
        hasProfile: false,
      })),
    });

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(initializeProfile).toHaveBeenCalledWith("en");
    });
    expect(options.setSettingsProfile).toHaveBeenCalledWith(
      expect.objectContaining({ email: "person@example.com", locale: "en" }),
    );
    expect(options.ensureOptionsLoaded).toHaveBeenCalled();
    expect(options.setHasProfile).toHaveBeenCalledWith(true);
    expect(options.setProfileCreated).toHaveBeenCalledWith(true);
    expect(options.bootstrapCapsules).toHaveBeenCalledWith(
      "person@example.com",
    );
    expect(mainScreenLoader.preloadMainScreen).toHaveBeenCalledTimes(1);
  });

  test("skips loading options when capsule bootstrap includes them", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      user: { email: "person@example.com" },
    });
    const options = createOptions({
      bootstrapCapsules: vi.fn(async () => ({
        ...createTestProfile(),
        hasProfile: true,
        optionsLoaded: true,
      })),
    });

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.setSessionInitialized).toHaveBeenCalledWith(true);
    });
    expect(options.ensureOptionsLoaded).not.toHaveBeenCalled();
  });

  test("loads options separately when capsule bootstrap omits them", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      user: { email: "person@example.com" },
    });
    const options = createOptions({
      bootstrapCapsules: vi.fn(async () => ({
        ...createTestProfile(),
        hasProfile: true,
        optionsLoaded: false,
      })),
    });

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.ensureOptionsLoaded).toHaveBeenCalled();
    });
  });

  test("does not preload MainScreen when the current route cannot use it", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      user: { email: "person@example.com" },
    });
    mainScreenLoader.shouldPreloadMainScreenForCurrentPath.mockReturnValue(
      false,
    );
    const options = createOptions();

    render(<Harness options={options} />);

    await waitFor(() => {
      expect(options.setSessionInitialized).toHaveBeenCalledWith(true);
    });
    expect(mainScreenLoader.preloadMainScreen).not.toHaveBeenCalled();
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
    expect(options.setSettingsProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        theme: "system",
        llm: "openai:gpt-5.5",
      }),
    );
    expect(options.bootstrapCapsules).not.toHaveBeenCalled();
    expect(mainScreenLoader.preloadMainScreen).not.toHaveBeenCalled();
  });
});
