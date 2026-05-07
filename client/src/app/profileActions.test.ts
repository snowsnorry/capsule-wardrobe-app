import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { createCapsule } from "../api/capsules";
import { deleteProfile, initializeProfile, updateProfile } from "../api/auth";
import { regenerateCapsuleWardrobe } from "../api/wardrobe";
import {
  backOnboarding,
  deleteUserProfile,
  finishOnboarding,
  nextOnboarding,
  saveSettings,
} from "./profileActions";
import {
  createActionContext,
  createTestCapsule,
  createTestProfile,
} from "./testUtils";

vi.mock("../api/auth", () => ({
  deleteProfile: vi.fn(),
  initializeProfile: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("../api/capsules", () => ({
  createCapsule: vi.fn(),
}));
vi.mock("../api/wardrobe", () => ({
  regenerateCapsuleWardrobe: vi.fn(),
}));

describe("profileActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("finishOnboarding creates a capsule with filters only and starts initial generation", async () => {
    vi.mocked(initializeProfile).mockResolvedValue({});
    vi.mocked(createCapsule).mockResolvedValue({
      capsule: createTestCapsule(),
    });
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValue({
      status: "pending",
    });
    const context = createActionContext();

    await finishOnboarding(context);

    expect(initializeProfile).toHaveBeenCalledWith("en");
    expect(createCapsule).toHaveBeenCalledWith({ filters: expect.any(Object) });
    expect(vi.mocked(createCapsule).mock.calls[0][0]).not.toHaveProperty(
      "draft",
    );
    expect(context.setProfileCreated).toHaveBeenCalledWith(true);
    expect(context.setHasProfile).toHaveBeenCalledWith(true);
    expect(context.setCurrentView).toHaveBeenCalledWith("main");
    expect(regenerateCapsuleWardrobe).toHaveBeenCalledWith({
      capsuleId: "capsule-1",
    });
    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith(
      "full",
      "none",
    );
    expect(context.startCapsuleEventStream).toHaveBeenCalledWith("capsule-1");
  });

  test("saveSettings persists settings and updates normalized app profile state", async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      profile: {
        email: "person@example.com",
        locale: "ru",
        theme: "dark",
        llm: "openai:gpt-5.5",
        image_llm: "gemini:gemini-3-pro-image-preview",
        fullname: "Ada Lovelace",
      },
    });
    const context = createActionContext({
      settingsProfile: createTestProfile({
        locale: "en",
        theme: "system",
        llm: "none",
      }),
    });

    await saveSettings(context, {
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      image_llm: "gemini:gemini-3-pro-image-preview",
    });

    expect(updateProfile).toHaveBeenCalledWith({
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      image_llm: "gemini:gemini-3-pro-image-preview",
    });
    expect(context.setSettingsProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        fullname: "Ada Lovelace",
        locale: "ru",
        theme: "dark",
        llm: "openai:gpt-5.5",
        imageLlm: "gemini:gemini-3-pro-image-preview",
      }),
    );
    expect(context.setLocale).toHaveBeenCalledWith("ru");
  });

  test("onboarding navigation guards required selections and clamps range", () => {
    const context = createActionContext({
      onboardingStep: 0,
      selectedFormalityLevel: "",
    });
    nextOnboarding(context);
    expect(context.setOnboardingStep).not.toHaveBeenCalled();

    nextOnboarding(
      createActionContext({ onboardingStep: 1, selectedOccasions: [] }),
    );
    nextOnboarding(
      createActionContext({ onboardingStep: 2, selectedSeason: [] }),
    );
    nextOnboarding(
      createActionContext({ onboardingStep: 3, selectedAudience: "" }),
    );

    const validContext = createActionContext({ onboardingStep: 3 });
    nextOnboarding(validContext);
    backOnboarding(validContext);

    const setOnboardingStepCalls = (validContext.setOnboardingStep as Mock).mock
      .calls;
    const nextUpdater = setOnboardingStepCalls[0][0] as (
      value: number,
    ) => number;
    const backUpdater = setOnboardingStepCalls[1][0] as (
      value: number,
    ) => number;
    expect(nextUpdater(3)).toBe(3);
    expect(backUpdater(0)).toBe(0);
  });

  test("finishOnboarding handles immediate generation, missing capsule id, and failures", async () => {
    vi.mocked(initializeProfile).mockResolvedValue({});
    vi.mocked(createCapsule).mockResolvedValueOnce({
      capsule: createTestCapsule({ id: "capsule-2" }),
    });
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValueOnce({
      status: "ready",
    });
    const readyContext = createActionContext();

    await finishOnboarding(readyContext);

    expect(readyContext.setIsLoadingItems).toHaveBeenLastCalledWith(false);

    vi.mocked(createCapsule).mockResolvedValueOnce({ capsule: { id: "" } });
    await finishOnboarding(createActionContext());
    expect(regenerateCapsuleWardrobe).toHaveBeenCalledTimes(1);

    vi.mocked(initializeProfile).mockRejectedValueOnce(
      new Error("invalid_payload"),
    );
    const failingContext = createActionContext();
    await finishOnboarding(failingContext);
    expect(failingContext.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "invalid_payload",
      infoKey: "",
      infoParams: null,
    });
  });

  test("saveSettings reports and rethrows normalized failures", async () => {
    vi.mocked(updateProfile).mockRejectedValueOnce(
      new Error("invalid_payload"),
    );
    const context = createActionContext();

    await expect(
      saveSettings(context, {
        fullname: "",
        locale: "en",
        theme: "system",
        llm: "none",
        image_llm: "openai:gpt-image-2",
      }),
    ).rejects.toThrow("invalid_payload");

    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "invalid_payload",
      infoKey: "",
      infoParams: null,
    });
  });

  test("deleteUserProfile logs out on success and reports failures", async () => {
    vi.mocked(deleteProfile).mockResolvedValueOnce({});
    const context = createActionContext();

    await deleteUserProfile(context);

    expect(deleteProfile).toHaveBeenCalledTimes(1);
    expect(context.handleLogout).toHaveBeenCalledTimes(1);

    vi.mocked(deleteProfile).mockRejectedValueOnce(new Error("not_found"));
    await deleteUserProfile(context);
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "not_found",
      infoKey: "",
      infoParams: null,
    });
  });
});
