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

test("t translates capsule sidebar labels", () => {
  expect(t("launcher.wardrobe", undefined, "ru")).toBe("Гардероб");
  expect(t("launcher.capsule", undefined, "ru")).toBe("Капсула");
});

test("t translates sidebar navigation labels", () => {
  expect(t("sidebar.catalog", undefined, "en")).toBe("Catalog");
  expect(t("sidebar.explore", undefined, "en")).toBe("Explore");
  expect(t("sidebar.statistics", undefined, "en")).toBe("Statistics");
  expect(t("sidebar.catalog", undefined, "ru")).toBe("Каталог");
  expect(t("sidebar.explore", undefined, "ru")).toBe("Обзор");
  expect(t("sidebar.statistics", undefined, "ru")).toBe("Статистика");
});

test("t translates app shell accessibility labels", () => {
  expect(t("appShell.toggleSidebar", undefined, "ru")).toBe(
    "Переключить боковую панель",
  );
  expect(t("appShell.collapseSidebar", undefined, "ru")).toBe(
    "Свернуть боковую панель",
  );
  expect(t("appShell.openUserMenu", undefined, "ru")).toBe(
    "Открыть меню пользователя",
  );
  expect(t("appShell.loadingSection", undefined, "ru")).toBe(
    "Загружаем раздел",
  );
});

test("t translates capsule action and outfit image accessibility labels", () => {
  expect(t("capsule.openCapsuleActions", { name: "Лето" }, "ru")).toBe(
    "Действия с капсулой Лето",
  );
  expect(t("capsule.nameLabel", undefined, "ru")).toBe("Название капсулы");
  expect(t("capsule.renameWithName", { name: "Лето" }, "ru")).toBe(
    "Переименовать капсулу Лето",
  );
  expect(t("capsule.editName", undefined, "ru")).toBe(
    "Изменить название капсулы",
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
