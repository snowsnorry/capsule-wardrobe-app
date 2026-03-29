import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "./LocaleProvider.jsx";
import { useI18n } from "./useI18n.js";

function Consumer() {
  const { locale, setLocale, supportedLocales, t } = useI18n();

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="supported">{supportedLocales.join(",")}</span>
      <span data-testid="translation">{t("locale.label")}</span>
      <button type="button" onClick={() => setLocale("ru")}>
        switch
      </button>
    </div>
  );
}

describe("useI18n", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  test("exposes the locale contract and updates translations after locale changes", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("locale", "en");

    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("supported")).toHaveTextContent("en,ru");
    expect(screen.getByTestId("translation")).toHaveTextContent(/./);

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  });
});
