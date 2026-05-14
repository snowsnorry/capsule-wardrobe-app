import { test, expect } from "vitest";
import {
  defaultLocale,
  isSupportedLocale,
  normalizeLocale,
  resolveTranslationValue,
  t,
  translateOption,
} from "./helpers.js";

test("normalizeLocale lowercases and strips region suffixes", () => {
  expect(normalizeLocale("EN-us")).toBe("en");
  expect(normalizeLocale("ru-RU")).toBe("ru");
  expect(normalizeLocale("")).toBe("");
});

test("isSupportedLocale reports supported locales only", () => {
  expect(isSupportedLocale("en")).toBe(true);
  expect(isSupportedLocale("ru")).toBe(true);
  expect(isSupportedLocale("de")).toBe(false);
});

test("t falls back to default locale and interpolates parameters", () => {
  expect(t("auth.codeSent", { minutes: 5 }, "ru")).toBe(
    "Код отправлен. Он будет действителен 5 минут.",
  );
  expect(t("appName", undefined, "de")).toBe("Capsule Wardrobe");
  expect(t("missing.path", undefined, "en")).toBe("missing.path");
  expect(defaultLocale).toBe("en");
});

test("t translates app launcher labels", () => {
  expect(t("launcher.myWardrobe", undefined, "ru")).toBe("Мой гардероб");
  expect(t("launcher.capsule", undefined, "ru")).toBe("Капсула");
  expect(t("launcher.explore", undefined, "ru")).toBe("Каталог");
  expect(t("launcher.statistics", undefined, "ru")).toBe("Статистика");
});

test("t translates capsule action and outfit image accessibility labels", () => {
  expect(t("capsule.openCapsuleActions", { name: "Лето" }, "ru")).toBe(
    "Действия с капсулой Лето",
  );
  expect(t("capsule.outfitSetImageAlt", { number: 2 }, "ru")).toBe("Образ 2");
  expect(t("capsule.createOutfitSetImage", undefined, "ru")).toBe(
    "Создать изображение",
  );
});

test("translateOption humanizes unknown values and translates known ones", () => {
  expect(translateOption("styles", "street_style", "en")).toBe("Street style");
  expect(translateOption("styles", "unknown_style", "en")).toBe(
    "Unknown Style",
  );
});

test("t resolves dictionary keys that contain dots", () => {
  expect(t("settings.llmOptions.openai:gpt-5.5", undefined, "en")).toBe(
    "OpenAI GPT-5.5",
  );
  expect(t("settings.llmOptions.claude:claude-opus-4-7", undefined, "en")).toBe(
    "Claude Opus 4.7",
  );
  expect(
    resolveTranslationValue(
      {
        settings: {
          llmOptions: {
            "openai:gpt-5.5": "OpenAI GPT-5.5",
            "claude:claude-opus-4-7": "Claude Opus 4.7",
          },
        },
      },
      "settings.llmOptions.claude:claude-opus-4-7",
    ),
  ).toBe("Claude Opus 4.7");
});
