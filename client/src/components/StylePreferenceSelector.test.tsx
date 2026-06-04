import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";

const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));
vi.mock("../i18n", () => ({
  translateOption: (_group: string, value: string) =>
    ({
      casual: "Casual",
      smart_casual: "Smart casual",
      formal: "Formal",
      minimalistic: "Minimalistic",
      retro: "Retro",
      boho: "Boho",
    })[value] || value,
}));

import StylePreferenceSelector from "./StylePreferenceSelector";

const theme = createTheme();

function renderSelector(
  props: Partial<ComponentProps<typeof StylePreferenceSelector>> = {},
) {
  useI18nMock.mockReturnValue({
    locale: "en",
    t: (key: string) =>
      ({
        "profile.stylesTitle": "Styles",
        "profile.stylesHint": "Choose a style",
        "profile.styleCoreTitle": "Core style",
        "profile.styleCoreHint": "Choose one core style.",
        "profile.styleAestheticTitle": "Aesthetic style",
        "profile.styleAestheticHint": "Choose optionally one aesthetic.",
        "profile.styleAestheticNotImportant": "Aesthetic not important",
      })[key] || key,
  });

  const defaults: ComponentProps<typeof StylePreferenceSelector> = {
    styleOptions: {
      core: ["formal", "casual"],
      aesthetics: ["retro", "minimalistic"],
    },
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <StylePreferenceSelector {...defaults} {...props} />
      </ThemeProvider>,
    ),
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
    expect(screen.getByText("Choose one core style.")).toBeInTheDocument();
    expect(
      screen.getByText("Choose optionally one aesthetic."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Casual" })).toHaveClass(
      "MuiChip-filled",
      "MuiChip-colorPrimary",
    );
    expect(
      screen.getByRole("button", { name: "Aesthetic not important" }),
    ).toHaveClass("MuiChip-filled", "MuiChip-colorPrimary");
    expect(screen.getByRole("button", { name: "Retro" })).toHaveClass(
      "MuiChip-filled",
      "MuiChip-colorDefault",
    );

    rerender(
      <ThemeProvider theme={theme}>
        <StylePreferenceSelector
          styleOptions={{
            core: ["casual", "formal"],
            aesthetics: ["minimalistic", "retro"],
          }}
          selectedStyleCore="formal"
          selectedStyleAesthetic="retro"
          onSelectStyleCore={vi.fn()}
          onSelectStyleAesthetic={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Formal" })).toHaveClass(
      "MuiChip-filled",
      "MuiChip-colorPrimary",
    );
    expect(
      screen.getByRole("button", { name: "Aesthetic not important" }),
    ).toHaveClass("MuiChip-filled", "MuiChip-colorDefault");
    expect(screen.getByRole("button", { name: "Retro" })).toHaveClass(
      "MuiChip-filled",
      "MuiChip-colorPrimary",
    );

    await user.unhover(screen.getByRole("button", { name: "Formal" }));
  });

  test("forwards core, aesthetic, and nullable aesthetic selections to callbacks", async () => {
    const user = userEvent.setup();
    const onSelectStyleCore = vi.fn();
    const onSelectStyleAesthetic = vi.fn();

    renderSelector({ onSelectStyleCore, onSelectStyleAesthetic });

    await user.click(screen.getByRole("button", { name: "Formal" }));
    await user.click(screen.getByRole("button", { name: "Retro" }));
    await user.click(
      screen.getByRole("button", { name: "Aesthetic not important" }),
    );

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenNthCalledWith(1, "retro");
    expect(onSelectStyleAesthetic).toHaveBeenNthCalledWith(2, null);
  });

  test("can hide the section heading when requested", () => {
    renderSelector({ showSectionHeading: false });

    expect(screen.queryByText("Styles")).not.toBeInTheDocument();
    expect(screen.getByText("Core style")).toBeInTheDocument();
    expect(screen.getByText("Choose one core style.")).toBeInTheDocument();
    expect(screen.getByText("Aesthetic style")).toBeInTheDocument();
    expect(
      screen.getByText("Choose optionally one aesthetic."),
    ).toBeInTheDocument();
  });

  test("sorts core by fixed order and aesthetics alphabetically with nullable option first", () => {
    renderSelector({
      styleOptions: {
        core: ["formal", "smart_casual", "casual"],
        aesthetics: ["retro", "boho", "minimalistic"],
      },
    });

    const casual = screen.getByRole("button", { name: "Casual" });
    const smartCasual = screen.getByRole("button", { name: "Smart casual" });
    const formal = screen.getByRole("button", { name: "Formal" });
    const notImportant = screen.getByRole("button", {
      name: "Aesthetic not important",
    });
    const boho = screen.getByRole("button", { name: "Boho" });
    const minimalistic = screen.getByRole("button", { name: "Minimalistic" });
    const retro = screen.getByRole("button", { name: "Retro" });

    expect(
      casual.compareDocumentPosition(smartCasual) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      smartCasual.compareDocumentPosition(formal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notImportant.compareDocumentPosition(boho) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      boho.compareDocumentPosition(minimalistic) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      minimalistic.compareDocumentPosition(retro) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
