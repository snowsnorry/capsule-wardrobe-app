import { beforeEach, describe, expect, test, vi } from "vitest";
import { deleteProfile, updateProfile } from "../api/auth";
import { deleteUserProfile, saveSettings } from "./profileActions";
import { createActionContext, createTestProfile } from "./testUtils";

vi.mock("../api/auth", () => ({
  clearRequestCache: vi.fn(),
  deleteProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

describe("profileActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saveSettings persists settings and updates normalized app profile state", async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      profile: {
        email: "person@example.com",
        locale: "ru",
        theme: "dark",
        llm: "openai:gpt-5.5",
        imageLlm: "gemini:gemini-3-pro-image-preview",
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
      imageLlm: "gemini:gemini-3-pro-image-preview",
    });

    expect(updateProfile).toHaveBeenCalledWith({
      fullname: "Ada Lovelace",
      locale: "ru",
      theme: "dark",
      llm: "openai:gpt-5.5",
      imageLlm: "gemini:gemini-3-pro-image-preview",
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
        imageLlm: "openai:gpt-image-2",
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

    const sessionContext = {
      closeNotificationPrompt: vi.fn(),
      resetCapsuleState: vi.fn(),
      resetNavigation: vi.fn(),
      resetProfileOptions: vi.fn(),
      resetSessionState: vi.fn(),
      setIsSignOutConfirmOpen: vi.fn(),
      setStatus: vi.fn(),
    };

    await deleteUserProfile(context, sessionContext as never);

    expect(deleteProfile).toHaveBeenCalledTimes(1);
    expect(context.handleLogout).not.toHaveBeenCalled();
    expect(sessionContext.resetSessionState).toHaveBeenCalledTimes(1);
    expect(sessionContext.resetCapsuleState).toHaveBeenCalledTimes(1);
    expect(sessionContext.resetProfileOptions).toHaveBeenCalledTimes(1);
    expect(sessionContext.resetNavigation).toHaveBeenCalledTimes(1);
    expect(sessionContext.setStatus).toHaveBeenCalledWith({
      loading: false,
      error: "",
      infoKey: "settings.accountRemoved",
      infoParams: null,
    });

    vi.mocked(deleteProfile).mockRejectedValueOnce(new Error("not_found"));
    await expect(
      deleteUserProfile(context, sessionContext as never),
    ).rejects.toThrow("not_found");
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "not_found",
      infoKey: "",
      infoParams: null,
    });
  });
});
