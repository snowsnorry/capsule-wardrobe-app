import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import SettingsDialog from "./SettingsDialog.jsx";

const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n.js", () => ({
  useI18n: useI18nMock
}));

const theme = createTheme();

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function renderDialog(props = {}) {
  useI18nMock.mockReturnValue({
    t: (key) => {
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
        "settings.fields.name": "Name",
        "settings.fields.email": "Email",
        "settings.themeOptions.system": "System",
        "settings.themeOptions.light": "Light",
        "settings.themeOptions.dark": "Dark",
        "locale.options.en": "English",
        "locale.options.ru": "Russian",
        "settings.llmOptions.openai:gpt-5.2": "OpenAI GPT-5.2",
        "settings.llmOptions.gemini:gemini-2.5-pro": "Gemini 2.5 Pro",
        "settings.llmOptions.deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct": "Qwen 3",
        "settings.llmOptions.deepinfra:google/gemma-3-27b-it": "Google Gemma 3",
        "settings.llmOptions.none": "None",
        "actions.cancel": "Cancel",
        "actions.save": "Save",
        "errors.generic": "Something went wrong"
      };

      return labels[key] || key;
    }
  });

  const defaults = {
    open: true,
    settings: {
      fullname: "Ada Lovelace",
      email: "ada@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.2"
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
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    deferred.resolve();
    await deferred.promise;
  });
});
