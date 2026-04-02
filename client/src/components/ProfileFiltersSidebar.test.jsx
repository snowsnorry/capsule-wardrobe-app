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

import ProfileFiltersSidebar from "./ProfileFiltersSidebar.jsx";

const theme = createTheme();

function renderSidebar(props = {}) {
  const defaults = {
    styleOptions: { core: ["casual", "formal"], aesthetics: ["minimalistic", "retro"] },
    occasionOptions: ["office", "travel"],
    seasonOptions: ["summer", "winter"],
    audienceOptions: ["woman", "man", "any"],
    accentColorOptions: ["blue", "red"],
    patternOptions: ["solid", "stripe"],
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    selectedOccasions: ["office"],
    selectedSeasons: ["summer"],
    selectedAudience: "woman",
    selectedAccentColor: "blue",
    selectedPattern: null,
    hasFilterChanges: true,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
    onSignOut: vi.fn(),
    isSigningOut: false
  };

  useI18nMock.mockReturnValue({
    locale: "en",
    t: (key, params) => {
      const labels = {
        "profile.occasionsTitle": "Occasions",
        "profile.occasionsHint": "Hint",
        "profile.seasonsTitle": "Seasons",
        "profile.seasonsHint": "Hint",
        "profile.audienceTitle": "Audience",
        "profile.audienceHint": "Hint",
        "profile.accentColorTitle": "Accent color",
        "profile.accentColorHint": "Hint",
        "profile.patternTitle": "Pattern",
        "profile.patternHint": "Hint",
        "profile.patternNotImportant": "Pattern not important",
        "profile.stylesTitle": "Styles",
        "profile.stylesHint": "Hint",
        "profile.styleCoreTitle": "Core style",
        "profile.styleAestheticTitle": "Aesthetic style",
        "profile.styleAestheticNotImportant": "Aesthetic not important",
        "filters.apply": "Apply",
        "filters.applyDisabledHint": "To apply filters, choose: {items}.",
        "filters.applyDisabledUnchangedHint": "Filters have not changed.",
        "filters.required.styleCore": "a core style",
        "filters.required.occasions": "at least one occasion",
        "filters.required.seasons": "at least one season",
        "filters.required.audience": "an audience",
        "filters.reset": "Reset",
        "actions.signOut": "Sign out",
        "main.partialRegenerateToggle": "Toggle"
      };

      if (key === "profile.info" && params?.count) {
        return `info:${params.count}`;
      }

      const label = labels[key] || key;
      return params
        ? label.replace(/\{(\w+)\}/g, (_, paramKey) => String(params[paramKey] ?? `{${paramKey}}`))
        : label;
    }
  });

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <ProfileFiltersSidebar {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("ProfileFiltersSidebar", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("forwards filter interactions to the corresponding callbacks", async () => {
    const user = userEvent.setup();
    const onSelectStyleCore = vi.fn();
    const onSelectStyleAesthetic = vi.fn();
    const onToggleOccasion = vi.fn();
    const onToggleSeason = vi.fn();
    const onSelectAudience = vi.fn();
    const onSelectAccentColor = vi.fn();
    const onSelectPattern = vi.fn();

    renderSidebar({
      onSelectStyleCore,
      onSelectStyleAesthetic,
      onToggleOccasion,
      onToggleSeason,
      onSelectAudience,
      onSelectAccentColor,
      onSelectPattern
    });

    await user.click(screen.getByRole("button", { name: "formal" }));
    await user.click(screen.getByRole("button", { name: "retro" }));
    await user.click(screen.getByRole("button", { name: "travel" }));
    await user.click(screen.getByRole("button", { name: "winter" }));
    await user.click(screen.getByRole("button", { name: "man" }));
    await user.click(screen.getByRole("button", { name: "red" }));
    await user.click(screen.getByRole("button", { name: "stripe" }));

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenCalledWith("retro");
    expect(onToggleOccasion).toHaveBeenCalledWith("travel");
    expect(onToggleSeason).toHaveBeenCalledWith("winter");
    expect(onSelectAudience).toHaveBeenCalledWith("man");
    expect(onSelectAccentColor).toHaveBeenCalledWith("red");
    expect(onSelectPattern).toHaveBeenCalledWith("stripe");
  });

  test("calls apply and reset callbacks and disables actions while loading", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onReset = vi.fn();

    const initial = renderSidebar({
      onApply,
      onReset,
      status: { loading: false, error: "Bad input", infoKey: "profile.info", infoParams: { count: 2 } }
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Bad input")).toBeInTheDocument();
    expect(screen.getByText("info:2")).toBeInTheDocument();

    initial.unmount();

    renderSidebar({
      onApply,
      onReset,
      status: { loading: true, error: "", infoKey: "", infoParams: null }
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(screen.queryByText(/To apply filters, choose:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Filters have not changed.")).not.toBeInTheDocument();
  });

  test("shows no hint and keeps apply enabled when required filters are selected", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.queryByText(/To apply filters, choose:/)).not.toBeInTheDocument();
  });

  test("shows a single missing required filter in the apply hint", () => {
    renderSidebar({
      selectedAudience: ""
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByText("To apply filters, choose: an audience.")).toBeInTheDocument();
  });

  test("shows all missing required filters in the apply hint", () => {
    renderSidebar({
      selectedStyleCore: "",
      selectedOccasions: [],
      selectedSeasons: [],
      selectedAudience: ""
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(
      screen.getByText(
        "To apply filters, choose: a core style, at least one occasion, at least one season, an audience."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Filters have not changed.")).not.toBeInTheDocument();
  });

  test("shows an unchanged hint and disables apply when filters did not change", () => {
    renderSidebar({
      hasFilterChanges: false
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByText("Filters have not changed.")).toBeInTheDocument();
    expect(screen.queryByText(/To apply filters, choose:/)).not.toBeInTheDocument();
  });
});
