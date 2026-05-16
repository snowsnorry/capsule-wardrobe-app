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
      solid: "Solid",
      stripe: "Stripe",
      abstract: "Abstract",
      argyle: "Argyle",
      graphic: "Graphic",
    })[value] || value,
}));

import ProfileFiltersSidebar from "./ProfileFiltersSidebar";

const theme = createTheme();

function renderSidebar(
  props: Partial<ComponentProps<typeof ProfileFiltersSidebar>> = {},
) {
  const defaults: ComponentProps<typeof ProfileFiltersSidebar> = {
    styleOptions: {
      core: ["casual", "formal"],
      aesthetics: ["minimalistic", "retro"],
    },
    occasionOptions: ["office", "travel"],
    seasonOptions: ["summer", "winter"],
    audienceOptions: ["woman", "man", "any"],
    accentColorOptions: ["blue", "red"],
    patternOptions: ["stripe", "solid"],
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    selectedOccasions: ["office"],
    selectedSeasons: ["summer"],
    selectedAudience: "woman",
    selectedAccentColor: "blue",
    selectedPattern: "solid",
    selectedSourceMode: "catalog_only",
    selectedText: "",
    hasFilterChanges: true,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onSelectSourceMode: vi.fn(),
    onTextChange: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
    onSignOut: vi.fn(),
    isSigningOut: false,
  };

  useI18nMock.mockReturnValue({
    locale: "en",
    t: (key: string, params?: Record<string, unknown>) => {
      const labels = {
        "profile.occasionsTitle": "Occasions",
        "profile.occasionsHint": "Hint",
        "profile.seasonsTitle": "Seasons",
        "profile.seasonsHint": "Hint",
        "profile.audienceTitle": "Audience",
        "profile.audienceHint": "Hint",
        "profile.accentColorTitle": "Accent color",
        "profile.accentColorHint": "Hint",
        "profile.accentColorNotImportant": "No accent color",
        "profile.patternTitle": "Pattern",
        "profile.patternHint": "Hint",
        "profile.additionalInfoTitle": "Additional information",
        "profile.additionalInfoHint": "Additional hint",
        "profile.additionalInfoPlaceholder": "Additional placeholder",
        "profile.stylesTitle": "Styles",
        "profile.stylesHint": "Hint",
        "profile.styleCoreTitle": "Core style",
        "profile.styleCoreHint": "Choose one core style.",
        "profile.styleAestheticTitle": "Aesthetic style",
        "profile.styleAestheticHint": "Choose optionally one aesthetic.",
        "profile.styleAestheticNotImportant": "Aesthetic not important",
        "capsule.settingsTitle": "Capsule settings",
        "capsule.settingsSubtitle":
          "Adjust the inputs used to build this capsule.",
        "capsule.preferWardrobe": "Prefer items from my wardrobe",
        "filters.apply": "Apply",
        "filters.applyDisabledHint": "To apply filters, choose: {items}.",
        "filters.applyDisabledUnchangedHint": "Filters have not changed.",
        "filters.required.styleCore": "a core style",
        "filters.required.occasions": "at least one occasion",
        "filters.required.seasons": "at least one season",
        "filters.required.audience": "an audience",
        "filters.reset": "Reset",
        "actions.signOut": "Sign out",
        "main.partialRegenerateToggle": "Toggle",
      };

      if (key === "profile.info" && params?.count) {
        return `info:${params.count}`;
      }

      const label = labels[key] || key;
      return params
        ? label.replace(/\{(\w+)\}/g, (_, paramKey) =>
            String(params[paramKey] ?? `{${paramKey}}`),
          )
        : label;
    },
  });

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <ProfileFiltersSidebar {...defaults} {...props} />
      </ThemeProvider>,
    ),
  };
}

describe("ProfileFiltersSidebar", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
  });

  test("shows no hint and keeps apply enabled when required filters are selected", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(
      screen.queryByText(/To apply filters, choose:/),
    ).not.toBeInTheDocument();
  });

  test("shows a single missing required filter in the apply hint", () => {
    renderSidebar({
      selectedAudience: "",
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(
      screen.getByText("To apply filters, choose: an audience."),
    ).toBeInTheDocument();
  });

  test("shows all missing required filters in the apply hint", () => {
    renderSidebar({
      selectedStyleCore: "",
      selectedOccasions: [],
      selectedSeasons: [],
      selectedAudience: "",
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(
      screen.getByText(
        "To apply filters, choose: a core style, at least one occasion, at least one season, an audience.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Filters have not changed."),
    ).not.toBeInTheDocument();
  });

  test("shows an unchanged hint and disables apply when filters did not change", () => {
    renderSidebar({
      hasFilterChanges: false,
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByText("Filters have not changed.")).toBeInTheDocument();
    expect(
      screen.queryByText(/To apply filters, choose:/),
    ).not.toBeInTheDocument();
  });

  test("treats a legacy null pattern as solid in the UI", () => {
    renderSidebar({
      selectedPattern: null,
    });

    expect(screen.getByRole("button", { name: "Solid" })).toHaveClass(
      "MuiChip-filledPrimary",
    );
    expect(screen.queryByText("Pattern not important")).not.toBeInTheDocument();
  });

  test("sorts pattern chips alphabetically by label with solid pinned first", () => {
    renderSidebar({
      patternOptions: ["stripe", "solid", "abstract"],
    });

    const solid = screen.getByRole("button", { name: "Solid" });
    const abstract = screen.getByRole("button", { name: "Abstract" });
    const stripe = screen.getByRole("button", { name: "Stripe" });

    expect(
      solid.compareDocumentPosition(abstract) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      abstract.compareDocumentPosition(stripe) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("renders the full canonical pattern list in the sidebar", () => {
    renderSidebar({
      patternOptions: ["stripe", "solid", "abstract"],
    });

    const solid = screen.getByRole("button", { name: "Solid" });
    const argyle = screen.getByRole("button", { name: "Argyle" });
    const graphic = screen.getByRole("button", { name: "Graphic" });

    expect(argyle).toBeInTheDocument();
    expect(graphic).toBeInTheDocument();
    expect(
      solid.compareDocumentPosition(argyle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("omits optional section hints and sign-out action when they are not provided", () => {
    renderSidebar({
      selectedOccasions: [],
      onSignOut: undefined,
    });

    expect(screen.getByText("Occasions")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sign out" }),
    ).not.toBeInTheDocument();
  });

  test("disables and calls the profile sign-out action", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderSidebar({ onSignOut, isSigningOut: true });
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();

    cleanup();
    renderSidebar({ onSignOut, isSigningOut: false });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
