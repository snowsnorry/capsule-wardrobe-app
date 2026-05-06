import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCapsule } from "../api/capsules";
import { initializeProfile, updateProfile } from "../api/auth";
import { regenerateCapsuleWardrobe } from "../api/wardrobe";
import { finishOnboarding, saveSettings } from "./profileActions";
import { createActionContext, createTestCapsule, createTestProfile } from "./testUtils";

vi.mock("../api/auth", () => ({
  deleteProfile: vi.fn(),
  initializeProfile: vi.fn(),
  updateProfile: vi.fn()
}));
vi.mock("../api/capsules", () => ({
  createCapsule: vi.fn()
}));
vi.mock("../api/wardrobe", () => ({
  regenerateCapsuleWardrobe: vi.fn()
}));

describe("profileActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("finishOnboarding creates a capsule with filters only and starts initial generation", async () => {
    vi.mocked(initializeProfile).mockResolvedValue({});
    vi.mocked(createCapsule).mockResolvedValue({ capsule: createTestCapsule() });
    vi.mocked(regenerateCapsuleWardrobe).mockResolvedValue({ status: "pending" });
    const context = createActionContext();

    await finishOnboarding(context);

    expect(initializeProfile).toHaveBeenCalledWith("en");
    expect(createCapsule).toHaveBeenCalledWith({ filters: expect.any(Object) });
    expect(vi.mocked(createCapsule).mock.calls[0][0]).not.toHaveProperty("draft");
    expect(context.setProfileCreated).toHaveBeenCalledWith(true);
    expect(context.setHasProfile).toHaveBeenCalledWith(true);
    expect(context.setCurrentView).toHaveBeenCalledWith("main");
    expect(regenerateCapsuleWardrobe).toHaveBeenCalledWith({ capsuleId: "capsule-1" });
    expect(context.startPendingNotificationFlow).toHaveBeenCalledWith("full", "none");
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
        fullname: "Ada Lovelace"
      }
    });
    const context = createActionContext({
      settingsProfile: createTestProfile({ locale: "en", theme: "system", llm: "none" })
    });

    await saveSettings(context, {
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      image_llm: "gemini:gemini-3-pro-image-preview"
    });

    expect(updateProfile).toHaveBeenCalledWith({
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      image_llm: "gemini:gemini-3-pro-image-preview"
    });
    expect(context.setSettingsProfile).toHaveBeenCalledWith(expect.objectContaining({
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      imageLlm: "gemini:gemini-3-pro-image-preview"
    }));
    expect(context.setLocale).toHaveBeenCalledWith("ru");
  });
});
