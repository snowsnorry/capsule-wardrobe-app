import { describe, expect, test } from "vitest";
import {
  formatPasskeyCreatedAt,
  normalizeImageLlmValue,
  normalizeLlmValue,
  normalizeLocaleValue,
  normalizeSettingsDraft,
  normalizeThemeValue,
} from "./settingsDialogModel";

describe("settingsDialogModel", () => {
  test("normalizes supported and unsupported option values", () => {
    expect(normalizeLocaleValue("ru")).toBe("ru");
    expect(normalizeLocaleValue("de")).toBe("en");
    expect(normalizeThemeValue("dark")).toBe("dark");
    expect(normalizeThemeValue("unknown")).toBe("system");
    expect(normalizeLlmValue("none")).toBe("none");
    expect(normalizeLlmValue("unknown")).toBe("openai:gpt-5.5");
    expect(normalizeImageLlmValue("gemini:gemini-3-pro-image-preview")).toBe(
      "gemini:gemini-3-pro-image-preview",
    );
    expect(normalizeImageLlmValue("unknown")).toBe("openai:gpt-image-2");
  });

  test("builds a settings draft from partial profile values", () => {
    expect(
      normalizeSettingsDraft(
        {
          fullname: null,
          email: "  ada@example.com  ",
          locale: "ru",
          theme: "light",
          llm: "none",
          imageLlm: "gemini:gemini-3-pro-image-preview",
        },
        "fallback@example.com",
      ),
    ).toEqual({
      fullname: "",
      email: "ada@example.com",
      locale: "ru",
      theme: "light",
      llm: "none",
      imageLlm: "gemini:gemini-3-pro-image-preview",
    });

    expect(normalizeSettingsDraft({}, " fallback@example.com ").email).toBe(
      "fallback@example.com",
    );
  });

  test("formats passkey creation timestamps when valid", () => {
    expect(formatPasskeyCreatedAt(null, "en-US")).toBeNull();
    expect(formatPasskeyCreatedAt("not-a-date", "en-US")).toBeNull();

    const formatted = formatPasskeyCreatedAt(
      "2026-05-01T01:47:00.000Z",
      "en-US",
    );
    expect(formatted?.date).toBeTruthy();
    expect(formatted?.time).toBeTruthy();
  });
});
