import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));

import AppLauncher from "./AppLauncher";

const theme = createTheme();

function renderLauncher(
  props: Partial<ComponentProps<typeof AppLauncher>> = {},
) {
  useI18nMock.mockReturnValue({
    t: (key) =>
      ({
        "launcher.open": "Open app launcher",
        "launcher.capsule": "Capsule",
        "launcher.capsuleHint": "Switch to the wardrobe capsule",
        "launcher.explore": "Explore",
        "launcher.exploreHint": "Switch to explore",
        "launcher.statistics": "Statistics",
        "launcher.statisticsHint": "Switch to statistics",
      })[key] || key,
  });

  const defaults: ComponentProps<typeof AppLauncher> = {
    currentApp: "capsule",
    onSelectApp: vi.fn(),
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <AppLauncher {...defaults} {...props} />
      </ThemeProvider>,
    ),
  };
}

describe("AppLauncher", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("opens the app menu and forwards the selected app id", async () => {
    const user = userEvent.setup();
    const onSelectApp = vi.fn();

    renderLauncher({ onSelectApp, currentApp: "capsule" });

    expect(
      screen.getByRole("button", { name: "Open app launcher" }),
    ).toHaveTextContent("Capsule");

    await user.click(screen.getByRole("button", { name: "Open app launcher" }));
    await user.click(screen.getByRole("menuitem", { name: /Explore/ }));

    expect(onSelectApp).toHaveBeenCalledWith("explore");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("reflects the current app label when rerendered from the parent", async () => {
    const user = userEvent.setup();
    const onSelectApp = vi.fn();
    const { rerender } = renderLauncher({ currentApp: "capsule", onSelectApp });

    await user.click(screen.getByRole("button", { name: "Open app launcher" }));
    await user.click(screen.getByRole("menuitem", { name: /Explore/ }));

    expect(onSelectApp).toHaveBeenCalledWith("explore");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <AppLauncher currentApp="explore" onSelectApp={vi.fn()} />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Open app launcher" }),
    ).toHaveTextContent("Explore");
  });

  test("shows the statistics app and can select it", async () => {
    const user = userEvent.setup();
    const onSelectApp = vi.fn();

    renderLauncher({ onSelectApp, currentApp: "capsule" });

    await user.click(screen.getByRole("button", { name: "Open app launcher" }));
    await user.click(screen.getByRole("menuitem", { name: /Statistics/ }));

    expect(onSelectApp).toHaveBeenCalledWith("statistics");
  });
});
