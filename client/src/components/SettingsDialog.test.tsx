import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import SettingsDialog from "./SettingsDialog";

const useI18nMock = vi.hoisted(() => vi.fn());
const passkeysApiMock = vi.hoisted(() => ({
  deletePasskey: vi.fn(),
  listPasskeys: vi.fn(),
}));
const passkeysAuthMock = vi.hoisted(() => ({
  registerPasskey: vi.fn(),
}));

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
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

function renderDialog(
  props: Partial<ComponentProps<typeof SettingsDialog>> = {},
) {
  if (!passkeysApiMock.listPasskeys.getMockImplementation()) {
    passkeysApiMock.listPasskeys.mockResolvedValue({ passkeys: [] });
  }
  passkeysApiMock.deletePasskey.mockResolvedValue({});
  passkeysAuthMock.registerPasskey.mockResolvedValue({});
  useI18nMock.mockReturnValue({
    locale: "en-US",
    t: (key: string, params?: Record<string, unknown>) => {
      const labels = {
        "settings.title": "Settings",
        "settings.sections.general": "General",
        "settings.sections.ai": "AI",
        "settings.sections.account": "Account",
        "settings.sectionHints.general":
          "Choose your visual and language preferences.",
        "settings.sectionHints.ai":
          "Pick which stylist model to save on your profile.",
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
        "settings.llmOptions.openai:gpt-5.5": "OpenAI GPT-5.5",
        "settings.llmOptions.claude:claude-opus-4-7": "Claude Opus 4.7",
        "settings.llmOptions.gemini:gemini-2.5-pro": "Gemini 2.5 Pro",
        "settings.llmOptions.deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct":
          "Qwen 3",
        "settings.llmOptions.deepinfra:google/gemma-4-31B-it": "Google Gemma 4",
        "settings.llmOptions.none": "None",
        "settings.imageLlmOptions.openai:gpt-image-2": "OpenAI GPT Image 2",
        "settings.imageLlmOptions.gemini:gemini-3-pro-image-preview":
          "Gemini 3 Pro Image Preview",
        "passkeys.title": "Passkeys",
        "passkeys.add": "Add passkey",
        "passkeys.remove": "Remove passkey",
        "passkeys.removeConfirm": "Remove this passkey?",
        "passkeys.empty": "No passkeys added yet.",
        "passkeys.defaultName": "Passkey",
        "passkeys.createdOn": "Created on {date} at {time}",
        "passkeys.backedUp": "Backed up",
        "passkeys.used": "Used before",
        "passkeys.loading": "Loading passkeys",
        "errors.passkeySetupFailed": "Passkey setup failed.",
        "errors.passkeyNotSupported": "Passkeys are not supported.",
        "actions.cancel": "Cancel",
        "actions.save": "Save",
        "errors.generic": "Something went wrong",
      };

      const label = labels[key] || key;
      return Object.entries(params || {}).reduce(
        (value, [paramKey, paramValue]) =>
          value.replace(`{${paramKey}}`, String(paramValue)),
        label,
      );
    },
  });

  const defaults: ComponentProps<typeof SettingsDialog> = {
    open: true,
    settings: {
      fullname: "Ada Lovelace",
      email: "ada@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    },
    onClose: vi.fn(),
    onSave: vi.fn(() => Promise.resolve()),
  };

  return {
    ...defaults,
    ...render(
      <ThemeProvider theme={theme}>
        <SettingsDialog {...defaults} {...props} />
      </ThemeProvider>,
    ),
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
    await user.click(
      screen.getByRole("combobox", { name: "Image Generation Model" }),
    );
    await user.click(
      screen.getByRole("option", { name: "Gemini 3 Pro Image Preview" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    deferred.resolve();
    await deferred.promise;
  });

  test("keeps field labels attached without dangling label for attributes", async () => {
    const user = userEvent.setup();
    renderDialog();

    const expectNoDanglingLabelTargets = () => {
      const labels = Array.from(
        document.body.querySelectorAll<HTMLLabelElement>("label[for]"),
      );
      for (const label of labels) {
        expect(document.getElementById(label.htmlFor)).not.toBeNull();
      }
    };

    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveAttribute(
      "id",
      "settings-theme",
    );
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveAttribute(
      "id",
      "settings-language",
    );
    expectNoDanglingLabelTargets();

    await user.click(screen.getByRole("button", { name: "AI" }));
    expect(
      screen.getByRole("combobox", { name: "Stylist Model" }),
    ).toHaveAttribute("id", "settings-stylist-model");
    expect(
      screen.getByRole("combobox", { name: "Image Generation Model" }),
    ).toHaveAttribute("id", "settings-image-llm");
    expectNoDanglingLabelTargets();

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "id",
      "settings-fullname",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "id",
      "settings-email",
    );
    expectNoDanglingLabelTargets();
  });

  test("renders passkeys as plain rows with created timestamps", async () => {
    const user = userEvent.setup();
    passkeysApiMock.listPasskeys.mockResolvedValue({
      passkeys: [
        {
          id: "passkey-1",
          name: "1Password",
          deviceType: "multiDevice",
          backedUp: true,
          lastUsedAt: "2026-05-02T01:47:00.000Z",
          createdAt: "2026-05-01T01:47:00.000Z",
        },
      ],
    });

    renderDialog();
    await user.click(screen.getByRole("button", { name: "Account" }));

    expect(await screen.findByText("1Password")).toBeInTheDocument();
    expect(screen.getByText(/Created on .+ at .+/)).toBeInTheDocument();
    expect(screen.queryByText("multiDevice")).not.toBeInTheDocument();
    expect(screen.queryByText("Backed up")).not.toBeInTheDocument();
    expect(screen.queryByText("Used before")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove passkey" }),
    ).toBeInTheDocument();
  });

  test("adds passkeys, ignores cancellations, and maps unsupported errors", async () => {
    const user = userEvent.setup();
    passkeysApiMock.listPasskeys
      .mockResolvedValueOnce({ passkeys: [] })
      .mockResolvedValueOnce({
        passkeys: [
          {
            id: "passkey-1",
            name: "New key",
            createdAt: "2026-05-01T01:47:00.000Z",
          },
        ],
      });

    renderDialog();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(
      await screen.findByRole("button", { name: "Add passkey" }),
    );

    expect(passkeysAuthMock.registerPasskey).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("New key")).toBeInTheDocument();

    passkeysAuthMock.registerPasskey.mockRejectedValueOnce(
      new Error("passkey_cancelled"),
    );
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    expect(screen.queryByText("Passkey setup failed.")).not.toBeInTheDocument();

    passkeysAuthMock.registerPasskey.mockRejectedValueOnce(
      new Error("passkey_not_supported"),
    );
    await user.click(screen.getByRole("button", { name: "Add passkey" }));
    expect(
      await screen.findByText("Passkeys are not supported."),
    ).toBeInTheDocument();
  });

  test("confirms passkey deletion and reports delete failures", async () => {
    const user = userEvent.setup();
    passkeysApiMock.listPasskeys.mockResolvedValue({
      passkeys: [
        {
          id: "passkey-1",
          name: "1Password",
          createdAt: "2026-05-01T01:47:00.000Z",
        },
      ],
    });
    passkeysApiMock.deletePasskey.mockRejectedValueOnce(
      new Error("delete failed"),
    );

    renderDialog();
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(
      await screen.findByRole("button", { name: "Remove passkey" }),
    );
    expect(screen.getByText("Remove this passkey?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove passkey" }));

    expect(await screen.findByText("delete failed")).toBeInTheDocument();

    passkeysApiMock.deletePasskey.mockResolvedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Remove passkey" }));
    await user.click(screen.getByRole("button", { name: "Remove passkey" }));
    expect(passkeysApiMock.deletePasskey).toHaveBeenLastCalledWith("passkey-1");
  });

  test("closes and shows save errors without closing the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {
      throw new Error("save failed");
    });

    renderDialog({ onClose, onSave });
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByLabelText("Name"));
    await user.keyboard(" Jr.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
