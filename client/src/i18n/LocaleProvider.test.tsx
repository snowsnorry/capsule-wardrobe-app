import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale } from "./LocaleProvider";

const STORAGE_KEY = "locale";

function Consumer() {
  const { locale, setLocale } = useLocale();

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale("ru-RU")}>
        set-locale
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  test("uses stored locale when it is supported and persists updates", async () => {
    window.localStorage.setItem(STORAGE_KEY, "ru");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("ru");

    screen.getByRole("button", { name: "set-locale" }).click();

    expect(screen.getByTestId("locale")).toHaveTextContent("ru");
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, "ru");
  });

  test("falls back to browser locale and then to default locale", () => {
    window.localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("ru-RU");

    render(
      <LocaleProvider>
        <Consumer />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("ru");
  });
});
