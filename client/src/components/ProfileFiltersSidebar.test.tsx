import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ComponentProps } from "react";
import { createAppTheme } from "../theme";

const useI18nMock = vi.hoisted(() => vi.fn());
const fetchMyWardrobeItemsMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/useI18n", () => ({
  useI18n: useI18nMock,
}));
vi.mock("../i18n", () => ({
  translateOption: (_group: string, value: string) =>
    ({
      bag: "Bag",
      belt: "Belt",
      bottom: "Bottom",
      dress: "Dress",
      midlayer: "Layering",
      outerwear: "Outerwear",
      shoes: "Shoes",
      solid: "Solid",
      stripe: "Stripe",
      top: "Top",
      abstract: "Abstract",
      argyle: "Argyle",
      graphic: "Graphic",
    })[value] || value,
}));
vi.mock("../api/myWardrobe", () => ({
  fetchMyWardrobeItems: fetchMyWardrobeItemsMock,
}));

import ProfileFiltersSidebar from "./ProfileFiltersSidebar";

const theme = createTheme();

function renderSidebar(
  props: Partial<ComponentProps<typeof ProfileFiltersSidebar>> = {},
  options: { themeOverride?: typeof theme } = {},
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
    selectedAnchorWardrobeItemIds: [],
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
    onSelectAnchorWardrobeItemIds: vi.fn(),
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
        "capsule.anchors.edit": "Add / edit",
        "capsule.anchors.unnamed": "{id}",
        "capsule.anchors.remove": "Remove {name}",
        "capsule.anchors.loadFailed": "Failed to load wardrobe items.",
        "capsule.anchors.dialogTitle": "Select anchor items",
        "capsule.anchors.selectedCount": "{count} of {max} selected",
        "capsule.anchors.selectedMax":
          "{count} of {max} selected · maximum reached",
        "capsule.anchors.type": "Type:",
        "capsule.anchors.typesAll": "All",
        "capsule.anchors.empty": "No wardrobe items found.",
        "capsule.anchors.apply": "Apply",
        "capsule.anchors.sources.all": "All",
        "capsule.anchors.sources.uploaded": "Uploaded",
        "capsule.anchors.sources.catalog": "Catalog",
        "filters.apply": "Apply",
        "filters.applyDisabledHint": "To apply filters, choose: {items}.",
        "filters.applyDisabledUnchangedHint": "Filters have not changed.",
        "filters.required.styleCore": "a core style",
        "filters.required.occasions": "at least one occasion",
        "filters.required.seasons": "at least one season",
        "filters.required.audience": "an audience",
        "filters.reset": "Reset",
        "actions.cancel": "Cancel",
        "actions.close": "Close",
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
      <ThemeProvider theme={options.themeOverride || theme}>
        <ProfileFiltersSidebar {...defaults} {...props} />
      </ThemeProvider>,
    ),
  };
}

describe("ProfileFiltersSidebar", () => {
  afterEach(() => {
    cleanup();
    useI18nMock.mockReset();
    fetchMyWardrobeItemsMock.mockReset();
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

  test("checks wardrobe-only source mode and blocks apply for an empty wardrobe", async () => {
    fetchMyWardrobeItemsMock.mockResolvedValue({ items: [] });

    renderSidebar({
      selectedSourceMode: "wardrobe_only",
      selectedSeasons: ["winter"],
    });

    expect(
      await screen.findByText(/My Wardrobe has no ready items/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(fetchMyWardrobeItemsMock).toHaveBeenCalledWith({ force: true });
  });

  test("warns but allows apply when wardrobe-only source mode has too few ready items", async () => {
    fetchMyWardrobeItemsMock.mockResolvedValue({
      items: [
        {
          category: "top",
          processingStatus: "ready",
        },
      ],
    });

    renderSidebar({
      selectedSourceMode: "wardrobe_only",
      selectedSeasons: ["winter"],
    });

    expect(
      await screen.findByText(
        /My Wardrobe has 1 ready items\. This capsule may need more:/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Layering: 2/)).toBeInTheDocument();
    expect(screen.queryByText(/midlayer/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });

  test("renders anchor empty state and applies picker selection", async () => {
    const user = userEvent.setup();
    const onSelectAnchorWardrobeItemIds = vi.fn();
    fetchMyWardrobeItemsMock.mockResolvedValue({
      items: [
        {
          id: 12,
          name: "White shirt",
          url: "https://example.com/shirt",
          imageUrl: "https://example.com/shirt.jpg",
          category: "top",
        },
      ],
    });

    renderSidebar({ onSelectAnchorWardrobeItemIds });
    await user.click(
      screen.getByRole("button", { name: "Add items from wardrobe" }),
    );
    await user.click(
      await screen.findByRole("button", { name: /White shirt/ }),
    );
    const footer = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");
    expect(footer).not.toBeNull();
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onSelectAnchorWardrobeItemIds).toHaveBeenCalledWith(["W12"]);
  });

  test("uses full-screen mobile surfaces for the anchor picker when requested", async () => {
    const user = userEvent.setup();
    const darkTheme = createAppTheme("dark");
    fetchMyWardrobeItemsMock.mockResolvedValue({
      items: [
        {
          id: 12,
          name: "White shirt",
          url: "https://example.com/shirt",
          imageUrl: "https://example.com/shirt.jpg",
          category: "top",
        },
      ],
    });

    renderSidebar(
      {
        anchorPickerFullScreen: true,
      },
      { themeOverride: darkTheme },
    );
    await user.click(
      screen.getByRole("button", { name: "Add items from wardrobe" }),
    );

    const title = await screen.findByText("Select anchor items");
    const header = title.closest(".MuiDialogTitle-root");
    const content = title
      .closest(".MuiDialog-paper")
      ?.querySelector(".MuiDialogContent-root");
    const footer = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");
    const paper = title.closest(".MuiDialog-paper");

    expect(paper).toHaveClass("MuiDialog-paperFullScreen");
    expect(header).not.toBeNull();
    expect(content).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(getComputedStyle(header!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(content!).backgroundColor).toBe("rgb(16, 24, 23)");
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
  });

  test("keeps anchor picker cancel local and disables sixth unselected item", async () => {
    const user = userEvent.setup();
    const onSelectAnchorWardrobeItemIds = vi.fn();
    fetchMyWardrobeItemsMock.mockResolvedValue({
      items: [1, 2, 3, 4, 5, 6].map((id) => ({
        id,
        name: `Item ${id}`,
        url: `wardrobe://${id}`,
        category: id === 6 ? "bottom" : "top",
      })),
    });

    renderSidebar({
      selectedAnchorWardrobeItemIds: ["W1", "W2", "W3", "W4", "W5"],
      onSelectAnchorWardrobeItemIds,
    });
    await user.click(screen.getByRole("button", { name: "Add / edit" }));

    expect(
      await screen.findByRole("button", { name: /Item 6/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSelectAnchorWardrobeItemIds).not.toHaveBeenCalled();
  });
});
