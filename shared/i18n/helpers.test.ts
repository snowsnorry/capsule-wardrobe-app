import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultLocale,
  isSupportedLocale,
  normalizeLocale,
  resolveTranslationValue,
  t,
  translateOption
} from "./helpers.js";

test("normalizeLocale lowercases and strips region suffixes", () => {
  assert.equal(normalizeLocale("EN-us"), "en");
  assert.equal(normalizeLocale("ru-RU"), "ru");
  assert.equal(normalizeLocale(""), "");
});

test("isSupportedLocale reports supported locales only", () => {
  assert.equal(isSupportedLocale("en"), true);
  assert.equal(isSupportedLocale("ru"), true);
  assert.equal(isSupportedLocale("de"), false);
});

test("t falls back to default locale and interpolates parameters", () => {
  assert.equal(t("auth.codeSent", { minutes: 5 }, "ru"), "Код отправлен. Он будет действителен 5 минут.");
  assert.equal(t("appName", undefined, "de"), "Capsule Wardrobe");
  assert.equal(t("missing.path", undefined, "en"), "missing.path");
  assert.equal(defaultLocale, "en");
});

test("translateOption humanizes unknown values and translates known ones", () => {
  assert.equal(translateOption("styles", "street_style", "en"), "Street style");
  assert.equal(translateOption("styles", "unknown_style", "en"), "Unknown Style");
});

test("t resolves dictionary keys that contain dots", () => {
  assert.equal(t("settings.llmOptions.openai:gpt-5.4", undefined, "en"), "OpenAI GPT-5.4");
  assert.equal(t("settings.llmOptions.claude:claude-opus-4-7", undefined, "en"), "Claude Opus 4.7");
  assert.equal(
    resolveTranslationValue(
      {
        settings: {
          llmOptions: {
            "openai:gpt-5.4": "OpenAI GPT-5.4",
            "claude:claude-opus-4-7": "Claude Opus 4.7"
          }
        }
      },
      "settings.llmOptions.claude:claude-opus-4-7"
    ),
    "Claude Opus 4.7"
  );
});
