import { describe, expect, test } from "vitest";
import {
  PROFILE_LLM_OPTIONS,
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
    expect(
      normalizeLlmValue("deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct"),
    ).toBe("deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct");
    expect(normalizeLlmValue("unknown")).toBe("openai:gpt-5.5");
    expect(normalizeImageLlmValue("gemini:gemini-3-pro-image")).toBe(
      "gemini:gemini-3-pro-image",
    );
    expect(normalizeImageLlmValue("unknown")).toBe("openai:gpt-image-2");
  });

  test("excludes deepinfra llms from visible settings options", () => {
    expect(PROFILE_LLM_OPTIONS).not.toContain(
      "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct",
    );
    expect(PROFILE_LLM_OPTIONS).not.toContain(
      "deepinfra:google/gemma-4-31B-it",
    );
    expect(PROFILE_LLM_OPTIONS).toContain("openai:gpt-5.5");
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
          imageLlm: "gemini:gemini-3-pro-image",
        },
        "fallback@example.com",
      ),
    ).toEqual({
      fullname: "",
      email: "ada@example.com",
      locale: "ru",
      theme: "light",
      llm: "none",
      imageLlm: "gemini:gemini-3-pro-image",
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
