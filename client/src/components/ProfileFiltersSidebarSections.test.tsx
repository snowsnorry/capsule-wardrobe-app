import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { ProfileFiltersSidebarFrame } from "./ProfileFiltersSidebarSections";
import type ProfileFiltersSidebar from "./ProfileFiltersSidebar";

vi.mock("../i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../i18n")>()),
  translateOption: (_group: string, value: string) =>
    ({
      solid: "Solid",
      stripe: "Stripe",
      abstract: "Abstract",
      argyle: "Argyle",
      graphic: "Graphic",
    })[value] || value,
}));

const theme = createTheme();

function t(key: string, params?: Record<string, unknown>) {
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
    "profile.additionalInfoTitle": "Additional information",
    "profile.additionalInfoHint": "Additional hint",
    "profile.additionalInfoPlaceholder": "Additional placeholder",
    "profile.styleCoreTitle": "Core style",
    "profile.styleCoreHint": "Choose one core style.",
    "profile.styleAestheticTitle": "Aesthetic style",
    "profile.styleAestheticHint": "Choose optionally one aesthetic.",
    "profile.styleAestheticNotImportant": "Aesthetic not important",
    "capsule.settingsTitle": "Capsule settings",
    "capsule.settingsSubtitle": "Adjust the inputs used to build this capsule.",
    "capsule.sourceMode.label": "Item source",
    "capsule.sourceMode.catalogOnly": "Catalog items",
    "capsule.sourceMode.wardrobePreferred": "My wardrobe + catalog",
    "capsule.sourceMode.wardrobeOnly": "My wardrobe only",
    "capsule.sourceMode.checkingWardrobe": "Checking My Wardrobe items...",
    "capsule.sourceMode.emptyWardrobe":
      "My Wardrobe has no ready items yet. Add items before using this source.",
    "capsule.sourceMode.loadFailed": "Could not check My Wardrobe items.",
    "capsule.sourceMode.insufficientWardrobe":
      "My Wardrobe has {count} ready items. This capsule may need more: {items}.",
    "capsule.anchors.title": "Anchor items",
    "capsule.anchors.hint": "Choose up to 5 wardrobe items to keep.",
    "capsule.anchors.add": "Add items from wardrobe",
    "filters.apply": "Apply",
    "filters.applyDisabledHint": "To apply filters, choose: {items}.",
    "filters.applyDisabledUnchangedHint": "Filters have not changed.",
    "filters.reset": "Reset",
    "actions.signOut": "Sign out",
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
}

function renderFrame({
  props = {},
  sortedPatternOptions = ["solid", "stripe"],
  normalizedSelectedPattern = "solid",
  missingRequiredFilters = [],
  showUnchangedFiltersHint = false,
  isApplyDisabled = false,
}: {
  props?: Partial<ComponentProps<typeof ProfileFiltersSidebar>>;
  sortedPatternOptions?: string[];
  normalizedSelectedPattern?: string;
  missingRequiredFilters?: string[];
  showUnchangedFiltersHint?: boolean;
  isApplyDisabled?: boolean;
} = {}) {
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
  const mergedProps = { ...defaults, ...props };

  return {
    props: mergedProps,
    ...render(
      <ThemeProvider theme={theme}>
        <ProfileFiltersSidebarFrame
          props={mergedProps}
          sortedPatternOptions={sortedPatternOptions}
          normalizedSelectedPattern={normalizedSelectedPattern}
          missingRequiredFilters={missingRequiredFilters}
          showUnchangedFiltersHint={showUnchangedFiltersHint}
          isApplyDisabled={isApplyDisabled}
          t={t}
          locale="en"
        />
      </ThemeProvider>,
    ),
  };
}

describe("ProfileFiltersSidebarSections", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the capsule settings header", () => {
    const { container } = renderFrame();
    const subtitle = screen.getByText(
      "Adjust the inputs used to build this capsule.",
    );
    const sourceModeSelect = screen.getByRole("combobox", {
      name: "Item source",
    });
    const firstDivider = container.querySelector(".MuiDivider-root");

    expect(
      screen.getByRole("heading", { name: "Capsule settings" }),
    ).toBeInTheDocument();
    expect(subtitle).toBeInTheDocument();
    expect(
      sourceModeSelect.compareDocumentPosition(subtitle) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(
      (firstDivider?.compareDocumentPosition(sourceModeSelect) ?? 0) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });

  test("can keep the subtitle while moving the settings title outside", () => {
    renderFrame({ props: { showSettingsTitle: false } });

    expect(
      screen.queryByRole("heading", { name: "Capsule settings" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Adjust the inputs used to build this capsule."),
    ).toBeInTheDocument();
  });

  test("renders source mode warning and disables apply for blocking source mode errors", () => {
    const warning = renderFrame({
      props: {
        sourceModeStatus: {
          isBlocking: false,
          message: "My Wardrobe has 2 ready items.",
          severity: "warning",
        },
      },
    });

    expect(
      screen.getByText("My Wardrobe has 2 ready items."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();

    warning.unmount();

    renderFrame({
      props: {
        sourceModeStatus: {
          isBlocking: true,
          message: "My Wardrobe has no ready items yet.",
          severity: "error",
        },
      },
      isApplyDisabled: true,
    });

    expect(
      screen.getByText("My Wardrobe has no ready items yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("keeps source mode labels wrap-friendly", async () => {
    const user = userEvent.setup();
    renderFrame();

    const sourceModeSelect = screen.getByRole("combobox", {
      name: "Item source",
    });
    expect(getComputedStyle(screen.getByText("Catalog items")).whiteSpace).toBe(
      "normal",
    );

    await user.click(sourceModeSelect);
    expect(
      getComputedStyle(
        await screen.findByRole("option", { name: "My wardrobe + catalog" }),
      ).whiteSpace,
    ).toBe("normal");
  });

  test("centers the anchor empty-state button content", () => {
    renderFrame();

    expect(
      getComputedStyle(
        screen.getByRole("button", { name: "Add items from wardrobe" }),
      ).justifyContent,
    ).toBe("center");
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
    const onSelectSourceMode = vi.fn();
    const onTextChange = vi.fn();

    renderFrame({
      props: {
        onSelectStyleCore,
        onSelectStyleAesthetic,
        onToggleOccasion,
        onToggleSeason,
        onSelectAudience,
        onSelectAccentColor,
        onSelectPattern,
        onSelectSourceMode,
        onTextChange,
      },
    });

    await user.click(screen.getByRole("button", { name: "formal" }));
    await user.click(screen.getByRole("button", { name: "retro" }));
    await user.click(screen.getByRole("button", { name: "travel" }));
    await user.click(screen.getByRole("button", { name: "winter" }));
    await user.click(screen.getByRole("button", { name: "man" }));
    await user.click(screen.getByRole("button", { name: "red" }));
    await user.click(screen.getByRole("button", { name: "Stripe" }));
    await user.click(screen.getByRole("combobox", { name: "Item source" }));
    await user.click(
      await screen.findByRole("option", { name: "My wardrobe + catalog" }),
    );
    await user.type(
      screen.getByPlaceholderText("Additional placeholder"),
      "linen only",
    );

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenCalledWith("retro");
    expect(onToggleOccasion).toHaveBeenCalledWith("travel");
    expect(onToggleSeason).toHaveBeenCalledWith("winter");
    expect(onSelectAudience).toHaveBeenCalledWith("man");
    expect(onSelectAccentColor).toHaveBeenCalledWith("red");
    expect(onSelectPattern).toHaveBeenCalledWith("stripe");
    expect(onSelectSourceMode).toHaveBeenCalledWith("wardrobe_preferred");
    expect(onTextChange).toHaveBeenCalled();
  });

  test("calls apply and reset callbacks and disables actions while loading", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onReset = vi.fn();

    const initial = renderFrame({
      props: {
        onApply,
        onReset,
        status: {
          loading: false,
          error: "Bad input",
          infoKey: "profile.info",
          infoParams: { count: 2 },
        },
      },
    });

    expect(
      screen
        .getByRole("button", { name: "Reset" })
        .compareDocumentPosition(
          screen.getByRole("button", { name: "Apply" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Bad input")).toBeInTheDocument();
    expect(screen.getByText("info:2")).toBeInTheDocument();

    initial.unmount();

    renderFrame({
      props: {
        onApply,
        onReset,
        status: { loading: true, error: "", infoKey: "", infoParams: null },
      },
      isApplyDisabled: true,
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    expect(
      screen.queryByText(/To apply filters, choose:/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Filters have not changed."),
    ).not.toBeInTheDocument();
  });

  test("disables filter controls while interactions are blocked", () => {
    const onSelectStyleCore = vi.fn();
    const onToggleOccasion = vi.fn();
    const onSelectAccentColor = vi.fn();
    const onTextChange = vi.fn();

    renderFrame({
      props: {
        isInteractionDisabled: true,
        onSelectStyleCore,
        onToggleOccasion,
        onSelectAccentColor,
        onTextChange,
      },
    });

    expect(screen.getByRole("button", { name: "formal" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "travel" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "red" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByPlaceholderText("Additional placeholder"),
    ).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Item source" })).toHaveClass(
      "Mui-disabled",
    );

    expect(onSelectStyleCore).not.toHaveBeenCalled();
    expect(onToggleOccasion).not.toHaveBeenCalled();
    expect(onSelectAccentColor).not.toHaveBeenCalled();
    expect(onTextChange).not.toHaveBeenCalled();
  });

  test("renders compact style sections without the parent style heading", () => {
    renderFrame();

    expect(screen.queryByText("Styles")).not.toBeInTheDocument();
    expect(screen.queryByText("profile.stylesTitle")).not.toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Choose one core style.")).toBeInTheDocument();
    expect(screen.getByText("Aesthetics")).toBeInTheDocument();
    expect(
      screen.getByText("Choose optionally one aesthetic."),
    ).toBeInTheDocument();
  });

  test("renders additional information field", () => {
    renderFrame({
      props: {
        selectedText: "Prefer natural fabrics",
      },
    });

    expect(screen.getByText("Additional information")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Prefer natural fabrics"),
    ).toBeInTheDocument();
  });
});
