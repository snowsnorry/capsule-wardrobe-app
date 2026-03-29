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

import StylePreferenceSelector from "./StylePreferenceSelector.jsx";

const theme = createTheme();

function renderSelector(props = {}) {
  useI18nMock.mockReturnValue({
    locale: "en",
    t: (key) => ({
      "profile.stylesTitle": "Styles",
      "profile.stylesHint": "Choose a style",
      "profile.styleCoreTitle": "Core style",
      "profile.styleAestheticTitle": "Aesthetic style",
      "profile.styleAestheticNotImportant": "Aesthetic not important"
    }[key] || key)
  });

  const defaults = {
    styleOptions: { core: ["casual", "formal"], aesthetics: ["minimalistic", "retro"] },
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn()
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <StylePreferenceSelector {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("StylePreferenceSelector", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("renders the selected core style and nullable aesthetic state", async () => {
    const user = userEvent.setup();
    const { rerender } = renderSelector();

    expect(screen.getByText("Styles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "casual" })).toHaveClass("MuiChip-filledPrimary");
    expect(screen.getByRole("button", { name: "Aesthetic not important" })).toHaveClass(
      "MuiChip-filledPrimary"
    );
    expect(screen.getByRole("button", { name: "retro" })).toHaveClass("MuiChip-filledDefault");

    rerender(
      <ThemeProvider theme={theme}>
        <StylePreferenceSelector
          styleOptions={{ core: ["casual", "formal"], aesthetics: ["minimalistic", "retro"] }}
          selectedStyleCore="formal"
          selectedStyleAesthetic="retro"
          onSelectStyleCore={vi.fn()}
          onSelectStyleAesthetic={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "formal" })).toHaveClass("MuiChip-filledPrimary");
    expect(screen.getByRole("button", { name: "Aesthetic not important" })).toHaveClass(
      "MuiChip-filledDefault"
    );
    expect(screen.getByRole("button", { name: "retro" })).toHaveClass("MuiChip-filledPrimary");

    await user.unhover(screen.getByRole("button", { name: "formal" }));
  });

  test("forwards core, aesthetic, and nullable aesthetic selections to callbacks", async () => {
    const user = userEvent.setup();
    const onSelectStyleCore = vi.fn();
    const onSelectStyleAesthetic = vi.fn();

    renderSelector({ onSelectStyleCore, onSelectStyleAesthetic });

    await user.click(screen.getByRole("button", { name: "formal" }));
    await user.click(screen.getByRole("button", { name: "retro" }));
    await user.click(screen.getByRole("button", { name: "Aesthetic not important" }));

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenNthCalledWith(1, "retro");
    expect(onSelectStyleAesthetic).toHaveBeenNthCalledWith(2, null);
  });

  test("can hide the section heading when requested", () => {
    renderSelector({ showSectionHeading: false });

    expect(screen.queryByText("Styles")).not.toBeInTheDocument();
    expect(screen.getByText("Core style")).toBeInTheDocument();
    expect(screen.getByText("Aesthetic style")).toBeInTheDocument();
  });
});
