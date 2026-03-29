import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultLocale,
  isSupportedLocale,
  normalizeLocale,
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
