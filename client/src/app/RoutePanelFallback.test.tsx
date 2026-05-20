import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { createAppTheme } from "../theme";
import RoutePanelFallback from "./RoutePanelFallback";

const theme = createAppTheme("light");

describe("RoutePanelFallback", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  test("localizes the loading progressbar label", () => {
    window.localStorage.setItem("locale", "ru");

    render(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <RoutePanelFallback />
        </LocaleProvider>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("progressbar", { name: "Загружаем раздел" }),
    ).toBeInTheDocument();
  });
});
