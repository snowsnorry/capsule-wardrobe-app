import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../i18n/useI18n.js", () => ({
  useI18n: useI18nMock
}));
vi.mock("../components/AppLauncher.jsx", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher.jsx", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));
vi.mock("../components/ProfileFiltersSidebar.jsx", () => ({
  default: ({ onApply, onReset, onSignOut }) => (
    <div data-testid="profile-filters-sidebar">
      <button type="button" onClick={onApply}>apply-filters</button>
      <button type="button" onClick={onReset}>reset-filters</button>
      {typeof onSignOut === "function" ? (
        <button type="button" onClick={onSignOut}>sign-out</button>
      ) : null}
    </div>
  )
}));
vi.mock("../components/ClothingGridPlaceholder.jsx", () => ({
  default: ({ count, inline }) => (
    <div data-testid={inline ? `inline-placeholder-${count}` : "loading-placeholder"} />
  ),
  ClothingPlaceholderCard: ({ placeholderKey }) => (
    <div data-testid={`placeholder-card-${placeholderKey}`} />
  )
}));
vi.mock("../components/ClothingCard.jsx", () => ({
  default: ({ item, isSelected, isSelectable, isRegenerating, onToggleSelected }) => (
    <button
      type="button"
      data-testid={`clothing-card-${item.url}`}
      data-selected={String(isSelected)}
      data-selectable={String(isSelectable)}
      data-regenerating={String(isRegenerating)}
      onClick={() => onToggleSelected(item)}
    >
      {item.name}
    </button>
  )
}));

import MainScreen from "./MainScreen.jsx";

const theme = createTheme();

function t(key, params) {
  const labels = {
    appName: "Capsule Wardrobe",
    locale: {
      options: {
        en: "English",
        ru: "Russian"
      }
    },
    filters: {
      open: "Open filters",
      apply: "Apply",
      cancel: "Cancel",
      title: "Filters"
    },
    actions: {
      signOut: "Sign out",
      cancel: "Cancel",
      ok: "OK",
      delete: "Delete",
      save: "Save",
      close: "Close"
    },
    capsule: {
      new: "New capsule",
      search: "Search capsules",
      yourCapsules: "Your capsules",
      notSaved: "Not saved",
      regenerateAll: "Regenerate all",
      exportPdf: "Export as PDF",
      rename: "Rename",
      revert: "Revert",
      saveAs: "Save as...",
      saveAsTitle: "Save as",
      renameTitle: "Rename capsule",
      deleteTitle: "Delete capsule",
      deleteOutfitSetImageTitle: "Delete image",
      revertTitle: "Revert changes",
      deleteConfirmBody: "Are you sure you want to delete this capsule? This action cannot be undone.",
      deleteOutfitSetImage: "Delete image",
      deleteOutfitSetImageConfirmBody: "Are you sure you want to delete this image? This action cannot be undone.",
      revertConfirmBody: "Discard the current unsaved changes and restore the last saved version of this capsule?",
      deleteConfirm: "Delete",
      revertConfirm: "Revert",
      searchPlaceholder: "Search capsules...",
      searchPrevious7Days: "Previous 7 Days",
      searchPrevious30Days: "Previous 30 Days",
      searchEarlier: "Earlier",
      outfitSet: "Набор {number}",
      closeFilters: "Close filters",
      openMenu: "Open capsule menu"
    },
    search: {
      all: "All"
    },
    main: {
      cancelSelection: "Cancel",
      regenerateSelected: `Regenerate Selected (${params?.count ?? 0})`,
      download: "Download capsule PDF",
      refresh: "Refresh wardrobe"
    },
    dialogs: {
      signOutTitle: "Sign out",
      signOutBody: "Are you sure you want to sign out?",
      signOutCancel: "Cancel",
      signOutConfirm: "Sign out"
    },
    settings: {
      title: "Settings",
      saved: "Settings saved.",
      sections: {
        general: "General",
        ai: "AI",
        account: "Account"
      },
      sectionHints: {
        general: "General settings",
        ai: "AI settings",
        account: "Account settings"
      },
      fields: {
        theme: "Theme",
        language: "Language",
        stylistModel: "Stylist Model",
        name: "Name",
        email: "Email"
      },
      themeOptions: {
        system: "System",
        light: "Light",
        dark: "Dark"
      },
      llmOptions: {
        "openai:gpt-5.2": "OpenAI GPT-5.2",
        "gemini:gemini-2.5-pro": "Gemini 2.5 Pro",
        "deepinfra:Qwen/Qwen3-VL-235B-A22B-Instruct": "Qwen 3",
        "deepinfra:google/gemma-4-31B-it": "Google Gemma 4",
        none: "None"
      }
    }
  };

  const value = key.split(".").reduce((current, part) => current?.[part], labels) || key;
  return typeof value === "string"
    ? value.replace(/\{(\w+)\}/g, (_, token) => String(params?.[token] ?? `{${token}}`))
    : value;
}

function renderScreen(props = {}, { mobile = false, layoutMode = mobile ? "overlay" : "medium" } = {}) {
  mediaQueryMock.mockImplementation((query) => {
    if (String(query).includes("max-width: 1279.95px")) {
      return layoutMode === "overlay";
    }
    if (String(query).includes("min-width: 1680px")) {
      return layoutMode === "large";
    }
    return false;
  });
  useI18nMock.mockReturnValue({ t });

  const defaults = {
    activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "new" },
    capsuleList: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    userEmail: "person@example.com",
    userName: "",
    settingsProfile: {
      fullname: "",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.2"
    },
    onSignOut: vi.fn(),
    onSaveSettings: vi.fn(() => Promise.resolve()),
    isSigningOut: false,
    onRefreshItems: vi.fn(),
    onDownloadPdf: vi.fn(),
    onCreateCapsule: vi.fn(),
    onOpenCapsule: vi.fn(() => Promise.resolve()),
    onSaveCapsule: vi.fn(() => Promise.resolve()),
    onRevertCapsule: vi.fn(() => Promise.resolve()),
    onRenameCapsule: vi.fn(() => Promise.resolve()),
    onDuplicateCapsule: vi.fn(() => Promise.resolve()),
    onDeleteCapsule: vi.fn(() => Promise.resolve()),
    onSearchCapsules: vi.fn(() => Promise.resolve([])),
    items: [],
    outfitSets: [],
    isLoadingItems: false,
    isContentBusy: false,
    isDownloadingPdf: false,
    showAdditionalItemPlaceholder: false,
    styleOptions: { core: ["casual"], aesthetics: ["minimalistic"] },
    occasionOptions: ["office"],
    seasonOptions: ["summer"],
    audienceOptions: ["woman"],
    accentColorOptions: ["blue"],
    patternOptions: ["solid"],
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    selectedOccasions: ["office"],
    selectedSeasons: ["summer"],
    selectedAudience: "woman",
    selectedAccentColor: null,
    selectedPattern: "solid",
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onApplyFilters: vi.fn(),
    onResetFilters: vi.fn(),
    onNavigateApp: vi.fn(),
    selectedRegenerationUrls: [],
    partialRegenerationPendingUrls: [],
    pendingImageSetIndexes: [],
    onToggleRegenerationSelection: vi.fn(),
    onCancelRegenerationSelection: vi.fn(),
    onRegenerateSelectedItems: vi.fn(),
    onDeleteOutfitSetImage: vi.fn(),
    onGenerateOutfitSetImage: vi.fn(),
    isPartialRegenerationLoading: false
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <MainScreen {...defaults} {...props} />
      </ThemeProvider>
    )
  };
}

describe("MainScreen", () => {
  beforeEach(() => {
    cleanup();
    mediaQueryMock.mockReset();
    useI18nMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders loading placeholder and disables action buttons while loading", () => {
    renderScreen({
      items: [],
      isLoadingItems: true,
      isContentBusy: true,
      isDownloadingPdf: true
    });

    expect(screen.getByTestId("loading-placeholder")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate all" })).toBeDisabled();
  });

  test("exposes overlay, medium desktop, and large desktop sidebar modes", async () => {
    const user = userEvent.setup();

    renderScreen({}, { mobile: true });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "overlay");
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-content-alignment", "overlay");
    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(await screen.findByText("New capsule")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await waitFor(() => {
      expect(screen.queryByText("New capsule")).not.toBeInTheDocument();
    });

    cleanup();
    renderScreen({}, { layoutMode: "medium" });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-medium");
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-content-alignment", "centered");
    expect(screen.getAllByRole("button", { name: "Toggle sidebar" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    cleanup();
    renderScreen({}, { layoutMode: "large" });
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-large");
    expect(screen.getByTestId("main-screen-shell")).toHaveAttribute("data-content-alignment", "centered");
    expect(screen.getAllByRole("button", { name: "Toggle sidebar" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  test("renders grid items, pending placeholders, and regeneration actions when selection exists", async () => {
    const user = userEvent.setup();
    const onToggleRegenerationSelection = vi.fn();
    const onCancelRegenerationSelection = vi.fn();
    const onRegenerateSelectedItems = vi.fn();

    renderScreen({
      items: [
        { id: "b", url: "https://example.com/b", name: "Blazer", category: "outerwear" },
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" }
      ],
      selectedRegenerationUrls: ["https://example.com/a"],
      partialRegenerationPendingUrls: ["https://example.com/b"],
      showAdditionalItemPlaceholder: true,
      onToggleRegenerationSelection,
      onCancelRegenerationSelection,
      onRegenerateSelectedItems
    });

    expect(screen.getByTestId("placeholder-card-pending-https://example.com/b")).toBeInTheDocument();
    expect(screen.getByTestId("clothing-card-https://example.com/a")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByRole("button", { name: "Download capsule PDF" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh wardrobe" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();
    expect(screen.getByTestId("inline-placeholder-1")).toBeInTheDocument();

    await user.click(screen.getByTestId("clothing-card-https://example.com/c"));
    expect(onToggleRegenerationSelection).toHaveBeenCalledWith({ id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelRegenerationSelection).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Regenerate Selected (1)" }));
    expect(onRegenerateSelectedItems).toHaveBeenCalledTimes(1);
  });

  test("renders outfit tabs and filters cards by wardrobe category order", async () => {
    const user = userEvent.setup();

    renderScreen({
      items: [
        { id: "b", url: "https://example.com/b", name: "Blazer", category: "outerwear" },
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "c", url: "https://example.com/c", name: "Trousers", category: "bottom" },
        { id: "d", url: "https://example.com/d", name: "Bag", category: "bag" }
      ],
      outfitSets: [
        { itemIds: ["c", "a", "d"] },
        { itemIds: ["x", "a"] }
      ]
    });

    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Набор 1" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Набор 2" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));

    const cards = screen.getAllByRole("button").filter((node) => (
      node.getAttribute("data-testid")?.startsWith("clothing-card-")
    ));
    expect(cards.map((node) => node.textContent)).toEqual(["Shirt", "Trousers", "Bag"]);
    expect(screen.queryByTestId("clothing-card-https://example.com/b")).not.toBeInTheDocument();
  });

  test("resets back to All when the selected outfit tab disappears", async () => {
    const user = userEvent.setup();
    const initialProps = {
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"] }]
    };
    const view = renderScreen(initialProps);

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));
    expect(screen.queryByRole("tab", { selected: true, name: "Набор 1" })).toBeInTheDocument();

    view.rerender(
      <ThemeProvider theme={theme}>
        <MainScreen
          {...view}
          {...initialProps}
          outfitSets={[]}
        />
      </ThemeProvider>
    );

    expect(screen.queryByRole("tab", { name: "Набор 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "All" })).not.toBeInTheDocument();
  });

  test("renders create image button for outfit tab without generated image", async () => {
    const user = userEvent.setup();
    const onGenerateOutfitSetImage = vi.fn();

    renderScreen({
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"] }],
      onGenerateOutfitSetImage
    });

    expect(screen.queryByRole("button", { name: "Create image" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Набор 1" }));
    await user.click(screen.getByRole("button", { name: "Create image" }));

    expect(onGenerateOutfitSetImage).toHaveBeenCalledWith(0);
  });

  test("renders placeholder while outfit set image is pending", async () => {
    const user = userEvent.setup();

    renderScreen({
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"] }],
      pendingImageSetIndexes: [0]
    });

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));

    expect(screen.getByTestId("outfit-set-image-placeholder")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create image" })).not.toBeInTheDocument();
  });

  test("renders generated outfit set image instead of action button", async () => {
    const user = userEvent.setup();

    renderScreen({
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"], image: "abc123" }]
    });

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));

    expect(screen.getByTestId("outfit-set-image")).toHaveAttribute("src", "data:image/png;base64,abc123");
    expect(screen.queryByRole("button", { name: "Create image" })).not.toBeInTheDocument();
  });

  test("opens the full-size outfit set image dialog on image click", async () => {
    const user = userEvent.setup();

    renderScreen({
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"], image: "abc123" }]
    });

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));
    await user.click(screen.getByTestId("outfit-set-image"));

    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByTestId("outfit-set-image-dialog")).not.toBeInTheDocument();
    });
  });

  test("confirms deleting an outfit set image", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());

    renderScreen({
      items: [
        { id: "a", url: "https://example.com/a", name: "Shirt", category: "top" },
        { id: "b", url: "https://example.com/b", name: "Trousers", category: "bottom" },
        { id: "c", url: "https://example.com/c", name: "Bag", category: "bag" }
      ],
      outfitSets: [{ itemIds: ["a", "b", "c"], image: "abc123" }],
      onDeleteOutfitSetImage
    });

    await user.click(screen.getByRole("tab", { name: "Набор 1" }));
    await user.click(screen.getByRole("button", { name: "Delete image" }));

    expect(screen.getByText("Are you sure you want to delete this image? This action cannot be undone.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteOutfitSetImage).toHaveBeenCalledWith(0);
  });

  test("opens mobile filters dialog and closes it through apply and reset actions", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn(() => Promise.resolve());
    const onResetFilters = vi.fn(() => Promise.resolve());

    renderScreen({
      onApplyFilters,
      onResetFilters
    }, { mobile: true });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getAllByText("apply-filters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("reset-filters").length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("apply-filters").at(-1));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });

    await user.click(screen.getByRole("button", { name: "Open filters" }));
    await user.click(screen.getAllByText("reset-filters").at(-1));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryAllByTestId("profile-filters-sidebar").length).toBe(1);
    });
  });

  test("hides mobile filters button and capsule label while regeneration selection is active", () => {
    renderScreen({
      selectedRegenerationUrls: ["https://example.com/a"],
      items: [{ id: "a", url: "https://example.com/a", name: "Shirt", category: "top" }]
    }, { mobile: true });

    expect(screen.queryByRole("button", { name: "Open filters" })).not.toBeInTheDocument();
    expect(screen.queryByText("Spring edit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate Selected (1)" })).toBeInTheDocument();
  });

  test("moves regenerate all into the header menu on mobile", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn();

    renderScreen({ onRefreshItems }, { mobile: true });

    expect(screen.queryByRole("button", { name: "Regenerate all" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Regenerate all" }));

    expect(onRefreshItems).toHaveBeenCalledTimes(1);
  });

  test("shows desktop inline rename trigger and keeps it out of the mobile header", async () => {
    const user = userEvent.setup();

    renderScreen();
    expect(screen.getByRole("button", { name: "Edit capsule name" })).toBeInTheDocument();

    cleanup();
    renderScreen({}, { mobile: true });
    expect(screen.queryByRole("button", { name: "Edit capsule name" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
  });

  test("enters inline rename mode from the desktop title and submits on Enter", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());

    renderScreen({ onRenameCapsule });

    await user.click(screen.getByRole("button", { name: "Rename capsule Spring edit" }));
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    expect(input).toHaveValue("Spring edit");

    await user.clear(input);
    await user.type(input, "Summer edit{Enter}");

    await waitFor(() => {
      expect(onRenameCapsule).toHaveBeenCalledWith("Summer edit", "capsule-1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Capsule name" })).not.toBeInTheDocument();
    });
  });

  test("enters inline rename mode from the desktop pencil and submits on blur", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());

    renderScreen({ onRenameCapsule });

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "Evening edit");
    await user.tab();

    await waitFor(() => {
      expect(onRenameCapsule).toHaveBeenCalledWith("Evening edit", "capsule-1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Capsule name" })).not.toBeInTheDocument();
    });
  });

  test("cancels desktop inline rename on Escape without sending a request", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());

    renderScreen({ onRenameCapsule });

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "Cancelled");
    await user.keyboard("{Escape}");

    expect(onRenameCapsule).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Capsule name" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Rename capsule Spring edit" })).toBeInTheDocument();
  });

  test("does not submit desktop inline rename for unchanged or whitespace-only values", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());

    renderScreen({ onRenameCapsule });

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    let input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.type(input, "   ");
    await user.tab();

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Capsule name" })).not.toBeInTheDocument();
    });
    expect(onRenameCapsule).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "  Spring edit  ");
    await user.tab();

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Capsule name" })).not.toBeInTheDocument();
    });
    expect(onRenameCapsule).not.toHaveBeenCalled();
  });

  test("keeps unsaved dot before the pencil trigger in the desktop header", () => {
    renderScreen({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: null,
        status: "new"
      }
    });

    const renameButton = screen.getByRole("button", { name: "Edit capsule name" });
    const renameContainer = renameButton.parentElement?.parentElement;
    const unsavedDot = renameContainer?.querySelector("svg[data-testid='FiberManualRecordRoundedIcon']");

    expect(unsavedDot).not.toBeNull();
    expect(unsavedDot?.compareDocumentPosition(renameButton.parentElement)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test("shows Save as for a saved capsule without a draft", async () => {
    const user = userEvent.setup();

    renderScreen({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: null,
        saved: { filters: {}, data: {} },
        status: "saved"
      }
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));

    expect(screen.getByRole("menuitem", { name: "Save as..." })).toBeInTheDocument();
  });

  test("shows Save as for a modified capsule", async () => {
    const user = userEvent.setup();

    renderScreen({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: { filters: {}, data: {} },
        status: "modified"
      }
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));

    expect(screen.getByRole("menuitem", { name: "Save as..." })).toBeInTheDocument();
  });

  test("hides Save as for a never-saved capsule", async () => {
    const user = userEvent.setup();

    renderScreen({
      activeCapsule: {
        id: "capsule-1",
        name: "Spring edit",
        draft: { filters: { locale: "en" }, data: {} },
        saved: null,
        status: "new"
      }
    });

    await user.click(screen.getByRole("button", { name: "Open capsule menu" }));

    expect(screen.queryByRole("menuitem", { name: "Save as..." })).not.toBeInTheDocument();
  });

  test("opens user menu and signs out", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderScreen({ onSignOut });

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Sign out|actions\.signOut/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("opens settings dialog and saves updated profile preferences", async () => {
    const user = userEvent.setup();
    const onSaveSettings = vi.fn(() => Promise.resolve());

    renderScreen({
      userName: "Ada Lovelace",
      settingsProfile: {
        fullname: "Ada Lovelace",
        email: "person@example.com",
        locale: "en",
        theme: "system",
        llm: "openai:gpt-5.2"
      },
      onSaveSettings
    });

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Settings" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Settings" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("combobox", { name: "Theme" }));
    await user.click(screen.getByRole("option", { name: "Dark" }));

    await user.click(within(dialog).getByRole("button", { name: "AI" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Stylist Model" }));
    await user.click(screen.getByRole("option", { name: "settings.llmOptions.openai:gpt-5.2" }));

    await user.click(within(dialog).getByRole("button", { name: "Account" }));
    const nameInput = within(dialog).getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Ada Byron");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSaveSettings).toHaveBeenCalledWith({
        fullname: "Ada Byron",
        locale: "en",
        theme: "dark",
        llm: "openai:gpt-5.2"
      });
    });
  });

  test("expands a collapsed desktop sidebar when clicking its empty area", async () => {
    const user = userEvent.setup();

    renderScreen({}, { layoutMode: "medium" });

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByText("Your capsules")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("collapsed-sidebar-expand-hitbox"));
    expect(screen.getByText("Your capsules")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  test("optimistically highlights a clicked capsule before open request resolves", async () => {
    const user = userEvent.setup();
    let resolveOpen;
    const onOpenCapsule = vi.fn(() => new Promise((resolve) => {
      resolveOpen = resolve;
    }));

    renderScreen({
      activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "saved" },
      capsuleList: [
        { id: "capsule-1", name: "Spring edit", status: "saved" },
        { id: "capsule-2", name: "Summer edit", status: "saved" }
      ],
      onOpenCapsule
    });

    const capsuleList = screen.getByRole("list");
    const springRow = within(capsuleList).getByText("Spring edit").closest(".MuiListItemButton-root");
    const summerRow = within(capsuleList).getByText("Summer edit").closest(".MuiListItemButton-root");

    expect(springRow).toHaveClass("Mui-selected");
    expect(summerRow).not.toHaveClass("Mui-selected");

    await user.click(within(capsuleList).getByText("Summer edit"));

    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-2");
    expect(summerRow).toHaveClass("Mui-selected");
    expect(springRow).not.toHaveClass("Mui-selected");

    resolveOpen();
  });

  test("deletes a sidebar capsule row by its explicit capsule id", async () => {
    const user = userEvent.setup();
    const onDeleteCapsule = vi.fn(() => Promise.resolve());

    renderScreen({
      activeCapsule: { id: "capsule-1", name: "Spring edit", draft: null, saved: null, status: "saved" },
      capsuleList: [
        { id: "capsule-1", name: "Spring edit", status: "saved" },
        { id: "capsule-2", name: "Summer edit", status: "new" }
      ],
      onDeleteCapsule
    });

    await user.click(screen.getByLabelText("Capsule actions Summer edit"));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1));

    expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2");
  });
});
