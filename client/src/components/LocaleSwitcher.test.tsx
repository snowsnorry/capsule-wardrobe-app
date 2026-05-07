import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));

import LocaleSwitcher from "./LocaleSwitcher";

const theme = createTheme();

function renderSwitcher(props = {}) {
  const setLocale = vi.fn();

  useI18nMock.mockReturnValue({
    locale: "en",
    setLocale,
    supportedLocales: ["en", "ru"],
    t: (key) =>
      ({
        "locale.label": "Language",
        "locale.flags.en": "EN",
        "locale.flags.ru": "RU",
        "locale.options.en": "English",
        "locale.options.ru": "Russian",
      })[key] || key,
  });

  return {
    setLocale,
    ...render(
      <ThemeProvider theme={theme}>
        <LocaleSwitcher {...props} />
      </ThemeProvider>,
    ),
  };
}

describe("LocaleSwitcher", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("opens the locale menu and forwards the selected locale", async () => {
    const user = userEvent.setup();
    const { setLocale } = renderSwitcher();

    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("menuitem", { name: /RU/ }));

    expect(setLocale).toHaveBeenCalledWith("ru");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("renders the current locale flag on the trigger", () => {
    renderSwitcher();

    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent(
      "EN",
    );
  });
});
