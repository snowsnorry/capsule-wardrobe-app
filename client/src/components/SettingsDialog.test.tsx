import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import SettingsDialog from "./SettingsDialog";

const useI18nMock = vi.hoisted(() => vi.fn());
const passkeysApiMock = vi.hoisted(() => ({
  deletePasskey: vi.fn(),
  listPasskeys: vi.fn()
}));
const passkeysAuthMock = vi.hoisted(() => ({
  registerPasskey: vi.fn()
}));

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock
}));
vi.mock("../api/passkeys", () => passkeysApiMock);
vi.mock("../auth/passkeys", () => passkeysAuthMock);

const theme = createTheme();

function createDeferred() {
  let resolve: () => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = () => nextResolve();
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function renderDialog(props: Partial<ComponentProps<typeof SettingsDialog>> = {}) {
  passkeysApiMock.listPasskeys.mockResolvedValue({ passkeys: [] });
  passkeysApiMock.deletePasskey.mockResolvedValue({});
  passkeysAuthMock.registerPasskey.mockResolvedValue({});
  useI18nMock.mockReturnValue({
    t: (key: string) => {
      const labels = {
        "settings.title": "Settings",
        "settings.sections.general": "General",
        "settings.sections.ai": "AI",
        "settings.sections.account": "Account",
        "settings.sectionHints.general": "Choose your visual and language preferences.",
        "settings.sectionHints.ai": "Pick which stylist model to save on your profile.",
        "settings.sectionHints.account": "Review your account details.",
        "settings.fields.theme": "Theme",
        "settings.fields.language": "Language",
        "settings.fields.stylistModel": "Stylist Model",
        "settings.fields.imageGenerationModel": "Image Generation Model",
        "settings.fields.name": "Name",
        "settings.fields.email": "Email",
        "settings.themeOptions.system": "System",
        "settings.themeOptions.light": "Light",
        "settings.themeOptions.dark": "Dark",
        "locale.options.en": "English",
        "locale.options.ru": "Russian",
        "settings.llmOptions.openai:gpt-5.4": "OpenAI GPT-5.4",
        "settings.llmOptions.claude:claude-opus-4-7": "Claude Opus 4.7",
        "settings.llmOptions.gemini:gemini-2.5-pro": "Gemini 2.5 Pro",
        "settings.llmOptions.deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct": "Qwen 3",
        "settings.llmOptions.deepinfra:google/gemma-4-31B-it": "Google Gemma 4",
        "settings.llmOptions.none": "None",
        "settings.imageLlmOptions.openai:gpt-image-2": "OpenAI GPT Image 2",
        "settings.imageLlmOptions.gemini:gemini-3-pro-image-preview": "Gemini 3 Pro Image Preview",
        "passkeys.title": "Passkeys",
        "passkeys.add": "Add passkey",
        "passkeys.remove": "Remove passkey",
        "passkeys.removeConfirm": "Remove this passkey?",
        "passkeys.empty": "No passkeys added yet.",
        "passkeys.defaultName": "Passkey",
        "passkeys.backedUp": "Backed up",
        "passkeys.used": "Used before",
        "passkeys.loading": "Loading passkeys",
        "errors.passkeySetupFailed": "Passkey setup failed.",
        "errors.passkeyNotSupported": "Passkeys are not supported.",
        "actions.cancel": "Cancel",
        "actions.save": "Save",
        "errors.generic": "Something went wrong"
      };

      return labels[key] || key;
    }
  });

  const defaults: ComponentProps<typeof SettingsDialog> = {
    open: true,
    settings: {
      fullname: "Ada Lovelace",
      email: "ada@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.4",
      imageLlm: "openai:gpt-image-2"
    },
    onClose: vi.fn(),
    onSave: vi.fn(() => Promise.resolve())
  };

  return {
    ...defaults,
    ...render(
      <ThemeProvider theme={theme}>
        <SettingsDialog {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("SettingsDialog", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
    passkeysApiMock.deletePasskey.mockReset();
    passkeysApiMock.listPasskeys.mockReset();
    passkeysAuthMock.registerPasskey.mockReset();
  });

  test("shows a header divider and turns it into a progress indicator while saving", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    const onSave = vi.fn(() => deferred.promise);

    renderDialog({ onSave });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "AI" }));
    await user.click(screen.getByRole("combobox", { name: "Stylist Model" }));
    await user.click(screen.getByRole("option", { name: "Qwen 3" }));
    await user.click(screen.getByRole("combobox", { name: "Image Generation Model" }));
    await user.click(screen.getByRole("option", { name: "Gemini 3 Pro Image Preview" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    deferred.resolve();
    await deferred.promise;
  });
});
