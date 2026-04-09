import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n.js", () => ({
  useI18n: useI18nMock
}));
vi.mock("../i18n/index.js", () => ({
  translateOption: (_group, value) => value
}));

import AccentColorChips from "./AccentColorChips.jsx";

const theme = createTheme();

function renderChips(props = {}) {
  useI18nMock.mockReturnValue({
    locale: "en",
    t: (key) =>
      ({
        "profile.accentColorNotImportant": "No accent color"
      }[key] || key)
  });

  const defaults = {
    options: ["blue", "red"]
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <AccentColorChips {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("AccentColorChips", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("supports single-select selection and nullable reset", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderChips({
      selectedValue: "blue",
      onSelect
    });

    expect(screen.getByRole("button", { name: "blue" })).toHaveClass("MuiChip-filledPrimary");
    expect(screen.getByRole("button", { name: "red" })).toHaveClass("MuiChip-filledDefault");
    expect(screen.getByRole("button", { name: "No accent color" })).toHaveClass("MuiChip-filledDefault");

    await user.click(screen.getByRole("button", { name: "red" }));
    await user.click(screen.getByRole("button", { name: "No accent color" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "red");
    expect(onSelect).toHaveBeenNthCalledWith(2, null);
  });

  test("uses multi-select mode when selectedValues and onToggle are provided", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderChips({
      selectedValues: ["red"],
      onToggle
    });

    expect(screen.getByRole("button", { name: "red" })).toHaveClass("MuiChip-filledPrimary");
    expect(screen.getByRole("button", { name: "blue" })).toHaveClass("MuiChip-filledDefault");

    await user.click(screen.getByRole("button", { name: "blue" }));
    expect(onToggle).toHaveBeenCalledWith("blue");
  });

  test("supports a custom empty label in multi-select mode", () => {
    renderChips({
      selectedValues: [],
      onToggle: vi.fn(),
      emptyLabel: "Not important"
    });

    expect(screen.getByRole("button", { name: "Not important" })).toHaveClass("MuiChip-filledPrimary");
  });
});
