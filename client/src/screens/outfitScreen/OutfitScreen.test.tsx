import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { OutfitMeta } from "../../app/appTypes";
import OutfitScreen from "./OutfitScreen";

const personalItemsApi = vi.hoisted(() => ({
  fetchPersonalItems: vi.fn(),
}));
const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

vi.mock("../../api/personalItems", () => personalItemsApi);
vi.mock("../../api/search", () => searchApi);
vi.mock("../mainScreen/CapsuleProductDetailDialog", () => ({
  default: ({
    item,
    mode,
    onApply,
    onClose,
    onEdit,
    onReadMode,
    onSetItemLike,
    open,
  }) =>
    open ? (
      <div role="dialog" aria-label="Product preview">
        <span>{item?.name}</span>
        <span>mode: {mode}</span>
        <button type="button" onClick={onClose}>
          Close preview
        </button>
        <button type="button" onClick={() => onEdit?.(item)}>
          Edit preview
        </button>
        <button type="button" onClick={onReadMode}>
          Read preview
        </button>
        <button
          type="button"
          onClick={() => onApply?.(item, { name: "Updated preview item" })}
        >
          Apply preview
        </button>
        <button type="button" onClick={() => onSetItemLike?.(item, true)}>
          Like preview
        </button>
      </div>
    ) : null,
}));
vi.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "actions.add": "Add",
        "actions.cancel": "Cancel",
        "actions.close": "Close",
        "actions.delete": "Delete",
        "actions.ok": "OK",
        "actions.save": "Save",
        "capsule.anchors.apply": "Apply",
        "capsule.anchors.empty": "No items",
        "capsule.cardColumnsOne": "1 column",
        "capsule.cardColumnsThree": "3 columns",
        "capsule.cardColumnsTwo": "2 columns",
        "capsule.cardLayout": "Card layout",
        "capsule.createOutfitSetImage": "Create image",
        "capsule.deleteConfirm": "Delete",
        "capsule.deleteOutfitSetImage": "Delete image",
        "capsule.deleteOutfitSetImageConfirmBody": "Delete this image?",
        "capsule.deleteOutfitSetImageTitle": "Delete image",
        "capsule.editName": "Edit capsule name",
        "capsule.exportPdf": "Export PDF",
        "capsule.nameLabel": "Capsule name",
        "capsule.notSaved": "Not saved",
        "capsule.openOutfitSetImagePreview": `Open outfit ${params?.number ?? ""} image preview`,
        "capsule.openProductMenu": "Open product menu",
        "capsule.outfitSetImageAlt": `Outfit set ${params?.number ?? ""}`,
        "capsule.outfitSetImageObsolete": "Image obsolete",
        "capsule.renameWithName": `Rename capsule ${params?.name ?? ""}`,
        "capsule.rename": "Rename",
        "capsule.revert": "Revert",
        "capsule.saveAs": "Save as",
        "filters.apply": "Apply",
        "filters.open": "Open filters",
        "filters.reset": "Reset",
        "filters.title": "Filters",
        "outfit.addItems": "Add items",
        "outfit.analyzeOutfit": "Analyze",
        "outfit.catalog": "Catalog",
        "outfit.catalogSelected": `${params?.count ?? 0} catalog`,
        "outfit.categoryCount": `${params?.count ?? 0} ${params?.category ?? ""}`,
        "outfit.confirmDelete": "Delete outfit?",
        "outfit.confirmRemoveItem": "Remove item?",
        "outfit.confirmRemoveSelected": "Remove selected?",
        "outfit.confirmRevert": "Revert outfit?",
        "outfit.deleteConfirm": "Delete",
        "outfit.deleteConfirmBody":
          "Are you sure you want to delete this outfit?",
        "outfit.deleteTitle": "Delete outfit",
        "outfit.emptySummary": "No items",
        "outfit.loading": "Loading outfit",
        "outfit.itemNotFoundDescription":
          "This outfit reference no longer resolves.",
        "outfit.itemNotFoundTitle": "Item not found",
        "outfit.noneSelected": "No items selected",
        "outfit.nameLabel": "Outfit name",
        "outfit.openActions": "Open actions",
        "outfit.openMissingItemActions": "Open missing item actions",
        "outfit.pin": "Pin outfit",
        "outfit.renameTitle": "Rename outfit",
        "outfit.regenerateReport": "Regenerate report",
        "outfit.reportConfidence": "Confidence",
        "outfit.reportGenerating": "Generating outfit report",
        "outfit.reportHideDetails": "Hide details",
        "outfit.reportIssues": "Issues",
        "outfit.reportIssueSuggestionLabel": "Suggestion:",
        "outfit.reportOpenMenu": "Open report actions",
        "outfit.reportOutdated": "Report may be outdated",
        "outfit.reportScoreColorHarmony": "Color harmony",
        "outfit.reportScoreFormalityCoherence": "Formality coherence",
        "outfit.reportScoreOverallCompatibility": "Overall compatibility",
        "outfit.reportScoreSeasonFit": "Season fit",
        "outfit.reportScoreStyleCoherence": "Style coherence",
        "outfit.reportScores": "Scores",
        "outfit.reportShowDetails": "Show details",
        "outfit.reportStrengths": "Strengths",
        "outfit.reportSuggestions": "Suggestions",
        "outfit.reportTitle": "Outfit report",
        "outfit.reportVerdict.valid": "Good match",
        "outfit.personalSelected": `${params?.count ?? 0} personal`,
        "outfit.personalItems": "Personal items",
        "outfit.removeConfirm": "Remove",
        "outfit.removeItemTitle": "Remove item",
        "outfit.removeSelectedCount": `Remove ${params?.count ?? 0}`,
        "outfit.removeSelectedTitle": "Remove selected items",
        "outfit.unpin": "Unpin outfit",
        "outfit.revertConfirm": "Revert",
        "outfit.revertConfirmBody": "Discard unsaved changes?",
        "outfit.revertTitle": "Revert changes",
        "outfit.selectItem": "Select",
        "main.cancelSelection": "Cancel selection",
        "options.categories.bag": "Bag",
        "options.categories.top": "Top",
        "profile.styleAestheticTitle": "Aesthetics",
        "profile.styleCoreTitle": "Core",
        "search.all": "All",
        "search.filters.audience": "Audience",
        "search.filters.brand": "Brand",
        "search.filters.category": "Category",
        "search.filters.closureType": "Closure type",
        "search.filters.fit": "Fit",
        "search.filters.likedItems": "Liked only",
        "search.filters.max": "Max",
        "search.filters.min": "Min",
        "search.filters.occasion": "Occasion",
        "search.filters.pattern": "Pattern",
        "search.filters.price": "Price",
        "search.filters.season": "Season",
        "search.filters.silhouette": "Silhouette",
        "search.notImportant": "Not important",
        "search.clear": "Clear search",
        "search.filters.query": `Search: ${params?.query ?? ""}`,
        "search.placeholder": "Search in natural language",
        "search.resultsCount": `${params?.count ?? 0} results`,
        "wardrobe.like": "Like",
        "wardrobe.likedBadge": "Liked",
        "wardrobe.removeLike": "Remove like",
        "wardrobe.filters.fromCatalog": "Catalog",
        "wardrobe.filters.uploaded": "Uploaded",
      };
      return labels[key] || key;
    },
  }),
}));

const theme = createTheme();
const originalMatchMedia = window.matchMedia;

function setViewportMobile(isMobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        (isMobile && query.includes("max-width:899px")) ||
        (!isMobile && query.includes("min-width:1200px")),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockCatalogSearch() {
  personalItemsApi.fetchPersonalItems.mockResolvedValue({ items: [] });
  searchApi.fetchSearchOptions.mockResolvedValue({
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["outerwear", "top"],
    seasons: ["winter"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["all"],
    colors: ["black"],
    patterns: ["solid"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["zip"],
    priceRange: { min: 0, max: 300 },
  });
  searchApi.runSearch.mockResolvedValue({
    total: 1,
    items: [
      {
        id: "catalog-1",
        url: "https://example.com/catalog-1",
        name: "Catalog jacket",
        category: "outerwear",
        imageUrl: "https://example.com/catalog-1.png",
      },
    ],
  });
}

function renderScreen(overrides: Record<string, unknown> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <OutfitScreen
        activeOutfit={{
          id: "outfit-1",
          name: "<New outfit>",
          status: "saved",
          effective: { items: [], image: null, imageObsolete: false },
        }}
        isContentBusy={false}
        isImagePending={false}
        onDeleteOutfit={vi.fn()}
        onDeleteOutfitImage={vi.fn()}
        onDownloadOutfitPdf={vi.fn()}
        onDuplicateOutfit={vi.fn()}
        onGenerateOutfitImage={vi.fn()}
        onRenameOutfit={vi.fn()}
        onReplaceOutfitItems={vi.fn()}
        onRevertOutfit={vi.fn()}
        onSaveOutfit={vi.fn()}
        onSetItemLike={vi.fn()}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

async function openOutfitActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open actions" }));
}

async function expectNoBrowserConfirm(action: () => Promise<void> | void) {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    await action();
    expect(confirm).not.toHaveBeenCalled();
  } finally {
    confirm.mockRestore();
  }
}

function buildReportOutfit(): OutfitMeta {
  return {
    id: "outfit-1",
    name: "Weekend",
    status: "saved",
    effective: {
      items: [
        {
          url: "https://example.com/jacket",
          source: "from_catalog",
          item: {
            id: "item-jacket",
            url: "https://example.com/jacket",
            name: "Preview jacket",
            category: "outerwear",
            imageUrl: "https://example.com/jacket.png",
          },
        },
      ],
      reportMeta: { stale: true },
      report: {
        schemaVersion: 1,
        itemsHash: "old-hash",
        verdict: {
          status: "valid",
          score: 0.86,
          summary: "Neutral utility outfit for cool dry weather.",
        },
        seasonality: {
          primarySeasons: ["spring", "autumn"],
          seasonScore: 0.84,
        },
        styleProfile: {
          primaryStyle: "street_style",
          formalityLevel: "casual",
          styleScore: 0.9,
        },
        compatibility: {
          overallScore: 0.86,
          styleCoherence: 0.9,
          formalityCoherence: 0.92,
          seasonalCoherence: 0.84,
          colorCoherence: 0.88,
          mainStrengths: ["Balanced neutral palette."],
          mainRisks: [],
        },
        colorAnalysis: {
          paletteType: "muted_neutral",
          colorScore: 0.88,
        },
        issues: [
          {
            severity: "warning",
            message: "Boots may feel heavy.",
            suggestion: "Try lighter shoes.",
            affectedItemIds: ["item-jacket"],
          },
        ],
        suggestions: [
          {
            priority: "medium",
            message: "Roll jeans slightly.",
            targetItemIds: ["item-jacket"],
          },
        ],
        confidence: {
          overall: 0.78,
          assumptions: ["Material weight is inferred."],
          lowConfidenceAspects: ["material_weight"],
        },
      },
    },
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: originalMatchMedia,
  });
});

describe("OutfitScreen", () => {
  test("uses the app primary scroll target for only the outfit cards", () => {
    renderScreen();

    const screenSurface = screen.getByTestId("outfit-screen");
    const contentColumn = screen.getByTestId("outfit-content");
    const cardsScroll = screen.getByTestId("outfit-cards-scroll");
    const cardsContent = screen.getByTestId("outfit-cards-content");

    expect(screenSurface).not.toHaveAttribute("data-app-primary-scroll-target");
    expect(getComputedStyle(screenSurface).overflow).toBe("hidden");
    expect(cardsScroll).toHaveAttribute(
      "data-app-primary-scroll-target",
      "true",
    );
    expect(getComputedStyle(cardsScroll).overflowY).toBe("auto");
    expect(getComputedStyle(cardsScroll).overflowX).toBe("hidden");
    expect(getComputedStyle(cardsScroll).overscrollBehaviorY).toBe("contain");
    expect(getComputedStyle(screenSurface).marginRight).not.toBe("auto");
    expect(getComputedStyle(contentColumn).marginRight).toBe("auto");
    expect(getComputedStyle(cardsContent).marginRight).toBe("auto");
  });

  test("hides outfit image actions for an empty outfit", () => {
    renderScreen();

    expect(
      screen.queryByTestId("outfit-set-image-divider"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create image" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  test("renders saved outfit image actions preview warning and delete flow", async () => {
    const user = userEvent.setup();
    const onGenerateOutfitImage = vi.fn(() => Promise.resolve());
    const onDeleteOutfitImage = vi.fn(() => Promise.resolve());

    const { rerender } = renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/jacket",
              source: "from_catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/jacket",
                name: "Preview jacket",
                category: "outerwear",
                imageUrl: "https://example.com/jacket.png",
              },
            },
          ],
          image: null,
          imageObsolete: false,
        },
      },
      onGenerateOutfitImage,
      onDeleteOutfitImage,
    });

    expect(screen.getByTestId("outfit-set-image-divider")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create image" }));
    expect(onGenerateOutfitImage).toHaveBeenCalledWith("outfit-1");

    rerender(
      <ThemeProvider theme={theme}>
        <OutfitScreen
          activeOutfit={{
            id: "outfit-1",
            name: "<New outfit>",
            status: "saved",
            effective: {
              items: [
                {
                  url: "https://example.com/jacket",
                  source: "from_catalog",
                  item: {
                    id: "catalog-1",
                    url: "https://example.com/jacket",
                    name: "Preview jacket",
                    category: "outerwear",
                    imageUrl: "https://example.com/jacket.png",
                  },
                },
              ],
              image: "https://images.example.com/outfit.png",
              imageObsolete: true,
            },
          }}
          isContentBusy={false}
          isImagePending={false}
          onDeleteOutfit={vi.fn()}
          onDeleteOutfitImage={onDeleteOutfitImage}
          onDownloadOutfitPdf={vi.fn()}
          onDuplicateOutfit={vi.fn()}
          onGenerateOutfitImage={onGenerateOutfitImage}
          onRenameOutfit={vi.fn()}
          onReplaceOutfitItems={vi.fn()}
          onRevertOutfit={vi.fn()}
          onSaveOutfit={vi.fn()}
          onSetItemLike={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Image obsolete")).toBeInTheDocument();
    await user.click(screen.getByTestId("outfit-set-image"));
    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByTestId("outfit-set-image-dialog"),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteOutfitImage).toHaveBeenCalledWith("outfit-1");
  });

  test("uses capsule-style inline title controls with unsaved dot", async () => {
    const user = userEvent.setup();
    const onRenameOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "modified",
        effective: { items: [] },
      },
      onRenameOutfit,
    });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rename capsule <New outfit>" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit capsule name" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Not saved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit capsule name" }));
    const input = screen.getByRole("textbox", { name: "Capsule name" });
    await user.clear(input);
    await user.type(input, "Weekend outfit{Enter}");

    await waitFor(() => {
      expect(onRenameOutfit).toHaveBeenCalledWith("Weekend outfit", "outfit-1");
    });
  });

  test("renders outfit summary with capsule-style separated labels", () => {
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/top",
              source: "from_catalog",
              item: {
                id: "catalog-top",
                url: "https://example.com/top",
                name: "Top",
                category: "top",
              },
            },
            {
              url: "https://example.com/bag",
              source: "from_catalog",
              item: {
                id: "catalog-bag",
                url: "https://example.com/bag",
                name: "Bag",
                category: "bag",
              },
            },
          ],
        },
      },
    });

    const summary = screen.getByTestId("outfit-summary");
    expect(within(summary).getByText("1 Top")).toBeInTheDocument();
    expect(within(summary).getByText("1 Bag")).toBeInTheDocument();
    expect(screen.queryByText("1 Top · 1 Bag")).not.toBeInTheDocument();
  });

  test("shows the header progress while outfit content is busy", () => {
    renderScreen({ isContentBusy: true, isReportPending: false });

    const progress = screen.getByRole("progressbar", {
      name: "Loading outfit",
    });
    expect(progress).toBeInTheDocument();
    const headerSeparator = within(
      screen.getByTestId("outfit-content"),
    ).getByRole("separator");
    expect(headerSeparator.nextElementSibling).toContainElement(progress);
  });

  test("renders analyze action and blocks it while report generation is pending", () => {
    const onGenerateOutfitReport = vi.fn(() => Promise.resolve());
    renderScreen({
      isContentBusy: true,
      isReportPending: true,
      onGenerateOutfitReport,
    });

    const progress = screen.getByRole("progressbar", {
      name: "Generating outfit report",
    });
    expect(progress).toBeInTheDocument();
    const headerSeparator = within(
      screen.getByTestId("outfit-content"),
    ).getByRole("separator");
    expect(headerSeparator.nextElementSibling).toContainElement(progress);
    const analyze = screen.getByRole("button", { name: "Analyze" });
    expect(analyze).toBeDisabled();
    expect(onGenerateOutfitReport).not.toHaveBeenCalled();
  });

  test("moves initial analyze action into the mobile outfit menu", async () => {
    setViewportMobile(true);
    const user = userEvent.setup();
    const onGenerateOutfitReport = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/jacket",
              source: "from_catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/jacket",
                name: "Preview jacket",
                category: "outerwear",
                imageUrl: "https://example.com/jacket.png",
              },
            },
          ],
        },
      },
      onGenerateOutfitReport,
    });

    expect(
      screen.queryByRole("button", { name: "Analyze" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Analyze" }));

    expect(onGenerateOutfitReport).toHaveBeenCalledWith("outfit-1");
  });

  test("disables the mobile analyze menu action for an empty outfit", async () => {
    setViewportMobile(true);
    const user = userEvent.setup();
    const onGenerateOutfitReport = vi.fn(() => Promise.resolve());
    renderScreen({ onGenerateOutfitReport });

    await user.click(screen.getByRole("button", { name: "Open actions" }));

    expect(screen.getByRole("menuitem", { name: "Analyze" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(onGenerateOutfitReport).not.toHaveBeenCalled();
  });

  test("renames outfits from the mobile outfit menu", async () => {
    setViewportMobile(true);
    const user = userEvent.setup();
    const onRenameOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "saved",
        effective: { items: [] },
      },
      onRenameOutfit,
    });

    await user.click(screen.getByRole("button", { name: "Open actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const renameDialog = screen.getByRole("dialog", {
      name: "Rename outfit",
    });
    const renameInput = within(renameDialog).getByRole("textbox", {
      name: "Rename outfit",
    });
    expect(renameInput).toHaveValue("Weekend");

    await user.clear(renameInput);
    expect(
      within(renameDialog).getByRole("button", { name: "OK" }),
    ).toBeDisabled();

    await user.type(renameInput, "  City outfit  ");
    await user.click(within(renameDialog).getByRole("button", { name: "OK" }));

    await waitFor(() =>
      expect(onRenameOutfit).toHaveBeenCalledWith("City outfit", "outfit-1"),
    );
  });

  test("renders report summary details menu actions and stale state", async () => {
    const user = userEvent.setup();
    const onGenerateOutfitReport = vi.fn(() => Promise.resolve());
    const onDeleteOutfitReport = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: buildReportOutfit(),
      isReportPending: true,
      onDeleteOutfitReport,
      onGenerateOutfitReport,
    });

    expect(
      screen.getAllByRole("progressbar", {
        name: "Generating outfit report",
      }),
    ).toHaveLength(1);
    expect(screen.getByText("Outfit report")).toBeInTheDocument();
    expect(screen.getByText("86")).toBeInTheDocument();
    expect(screen.getByText("Good match")).toBeInTheDocument();
    expect(screen.getByText("Report may be outdated")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analyze" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText("Style coherence")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Balanced neutral palette.")).toBeInTheDocument();
    expect(screen.getByText("Boots may feel heavy.")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 78%")).toBeInTheDocument();
    expect(screen.queryByText("78% confidence")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(2);
    await user.click(
      screen.getByRole("menuitem", { name: "Regenerate report" }),
    );
    expect(onGenerateOutfitReport).toHaveBeenCalledWith("outfit-1");

    await user.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDeleteOutfitReport).toHaveBeenCalledWith("outfit-1");
  });

  test("renders desktop report as a floating inspector outside the cards scroll", () => {
    setViewportMobile(false);
    renderScreen({ activeOutfit: buildReportOutfit() });

    const cardsScroll = screen.getByTestId("outfit-cards-scroll");
    const floatingInspector = screen.getByTestId(
      "outfit-report-floating-inspector",
    );

    expect(floatingInspector).toContainElement(
      screen.getByTestId("outfit-report"),
    );
    expect(within(cardsScroll).queryByTestId("outfit-report")).toBeNull();
    expect(screen.getByText("Style coherence")).toBeInTheDocument();
  });

  test("highlights linked outfit cards from report issue focus", async () => {
    const user = userEvent.setup();
    renderScreen({ activeOutfit: buildReportOutfit() });

    await user.click(screen.getByRole("button", { name: "Show details" }));
    const issueRow = screen
      .getByText("Boots may feel heavy.")
      .closest("[tabindex='0']");
    expect(issueRow).toBeTruthy();
    fireEvent.focus(issueRow as HTMLElement);

    expect(screen.getByTestId("outfit-item-highlighted")).toBeInTheDocument();
  });

  test("highlights uploaded outfit cards from W-prefixed report item ids", async () => {
    const user = userEvent.setup();
    const activeOutfit = buildReportOutfit();
    const effective = activeOutfit.effective;
    expect(effective?.report?.issues?.[0]).toBeTruthy();
    expect(effective?.report?.suggestions?.[0]).toBeTruthy();

    effective!.items = [
      {
        url: "wardrobe://bottom",
        source: "uploaded",
        item: {
          id: "18",
          source: "uploaded",
          url: "wardrobe://bottom",
          name: "Preview jeans",
          category: "bottom",
          imageUrl: "https://example.com/jeans.png",
        },
      },
    ];
    effective!.report!.issues![0].affectedItemIds = ["W18"];
    effective!.report!.suggestions![0].targetItemIds = ["W18"];

    renderScreen({ activeOutfit });

    await user.click(screen.getByRole("button", { name: "Show details" }));
    const issueRow = screen
      .getByText("Boots may feel heavy.")
      .closest("[tabindex='0']");
    expect(issueRow).toBeTruthy();
    fireEvent.focus(issueRow as HTMLElement);

    expect(screen.getByTestId("outfit-item-highlighted")).toBeInTheDocument();
  });

  test("opens item preview when an outfit card is clicked", async () => {
    const user = userEvent.setup();
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/jacket",
              source: "from_catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/jacket",
                name: "Preview jacket",
                category: "outerwear",
                imageUrl: "https://example.com/jacket.png",
              },
            },
          ],
        },
      },
    });

    await user.click(screen.getByRole("button", { name: /Preview jacket/i }));

    const preview = screen.getByRole("dialog", { name: "Product preview" });
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByText("Preview jacket")).toBeInTheDocument();
  });

  test("applies uploaded preview edits and preview likes to the outfit", async () => {
    const user = userEvent.setup();
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const onSetItemLike = vi.fn(() => Promise.resolve());
    const onUpdateUploadedWardrobeItem = vi.fn(() =>
      Promise.resolve({
        id: 42,
        url: "https://example.com/uploaded",
        name: "Updated preview item",
        category: "outerwear",
        imageUrl: "https://example.com/uploaded.png",
        source: "uploaded",
      }),
    );
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              url: "https://example.com/uploaded",
              source: "uploaded",
              item: {
                id: 42,
                url: "https://example.com/uploaded",
                name: "Uploaded jacket",
                category: "outerwear",
                imageUrl: "https://example.com/uploaded.png",
                source: "uploaded",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
      onSetItemLike,
      onUpdateUploadedWardrobeItem,
    });

    await user.click(screen.getByRole("button", { name: /Uploaded jacket/i }));
    await user.click(screen.getByRole("button", { name: "Edit preview" }));
    expect(screen.getByText("mode: edit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Read preview" }));
    expect(screen.getByText("mode: read")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply preview" }));
    await waitFor(() => {
      expect(onUpdateUploadedWardrobeItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42 }),
        { name: "Updated preview item" },
      );
      expect(onReplaceOutfitItems).toHaveBeenCalledWith("outfit-1", [
        expect.objectContaining({
          item: expect.objectContaining({ name: "Updated preview item" }),
        }),
      ]);
    });

    await user.click(screen.getByRole("button", { name: "Like preview" }));
    expect(onSetItemLike).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/uploaded" }),
      true,
    );

    await user.click(screen.getByRole("button", { name: "Close preview" }));
    expect(
      screen.queryByRole("dialog", { name: "Product preview" }),
    ).not.toBeInTheDocument();
  });

  test("handles desktop outfit item menu like, select, and remove actions", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const onSetItemLike = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              url: "https://example.com/context-jacket",
              source: "from_catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/context-jacket",
                name: "Context jacket",
                category: "outerwear",
                imageUrl: "https://example.com/context-jacket.png",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
      onSetItemLike,
    });

    const openMenu = async () => {
      await screen.findByRole("button", { name: /Context jacket/i });
      fireEvent.click(document.querySelector(".wardrobe-card-product-menu")!);
    };

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Like" }));
    expect(onSetItemLike).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/context-jacket" }),
      true,
    );

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Cancel selection" }));

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await screen.findByRole("button", { name: "Cancel selection" });
    const selectedCard = screen.getByRole("button", {
      name: /Context jacket/i,
    });
    await user.click(selectedCard);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Cancel selection" }),
      ).not.toBeInTheDocument();
    });

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await screen.findByRole("button", { name: "Cancel selection" });
    await user.click(screen.getByRole("button", { name: "Remove 1" }));
    const selectedDialog = screen.getByRole("dialog", {
      name: "Remove selected items",
    });
    expect(within(selectedDialog).getByText("Remove selected?")).toBeVisible();
    await user.click(
      within(selectedDialog).getByRole("button", { name: "Remove" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const itemDialog = screen.getByRole("dialog", { name: "Remove item" });
    expect(within(itemDialog).getByText("Remove item?")).toBeVisible();
    await user.click(
      within(itemDialog).getByRole("button", { name: "Remove" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);
  });

  test("renders missing outfit items with select and delete actions", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              url: "wardrobe://missing",
              source: "uploaded",
              item: null,
            },
          ],
        },
      },
      onReplaceOutfitItems,
    });

    expect(screen.getByText("Item not found")).toBeInTheDocument();
    expect(
      screen.getByText("This outfit reference no longer resolves."),
    ).toBeInTheDocument();

    const openMenu = async () => {
      await user.click(
        screen.getByRole("button", { name: "Open missing item actions" }),
      );
    };

    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Like" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Select" }));
    await screen.findByRole("button", { name: "Cancel selection" });
    await user.click(screen.getByRole("button", { name: "Remove 1" }));
    const selectedDialog = screen.getByRole("dialog", {
      name: "Remove selected items",
    });
    expect(within(selectedDialog).getByText("Remove selected?")).toBeVisible();
    await user.click(
      within(selectedDialog).getByRole("button", { name: "Remove" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const itemDialog = screen.getByRole("dialog", { name: "Remove item" });
    expect(within(itemDialog).getByText("Remove item?")).toBeVisible();
    await user.click(
      within(itemDialog).getByRole("button", { name: "Remove" }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(onReplaceOutfitItems).toHaveBeenLastCalledWith("outfit-1", []);
  });

  test("sorts outfit cards by the capsule wardrobe order", () => {
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "<New outfit>",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/bag",
              source: "from_catalog",
              item: {
                id: "bag",
                url: "https://example.com/bag",
                name: "Bag",
                category: "bag",
                imageUrl: "https://example.com/bag.png",
              },
            },
            {
              url: "https://example.com/trousers",
              source: "from_catalog",
              item: {
                id: "trousers",
                url: "https://example.com/trousers",
                name: "Trousers",
                category: "bottom",
                imageUrl: "https://example.com/trousers.png",
              },
            },
            {
              url: "https://example.com/shirt",
              source: "from_catalog",
              item: {
                id: "shirt",
                url: "https://example.com/shirt",
                name: "Shirt",
                category: "top",
                imageUrl: "https://example.com/shirt.png",
              },
            },
            {
              url: "https://example.com/blazer",
              source: "from_catalog",
              item: {
                id: "blazer",
                url: "https://example.com/blazer",
                name: "Blazer",
                category: "outerwear",
                imageUrl: "https://example.com/blazer.png",
              },
            },
          ],
        },
      },
    });

    const blazer = screen.getByRole("button", { name: /Blazer/i });
    const shirt = screen.getByRole("button", { name: /Shirt/i });
    const trousers = screen.getByRole("button", { name: /Trousers/i });
    const bag = screen.getByRole("button", { name: /Bag/i });

    expect(blazer.compareDocumentPosition(shirt)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(shirt.compareDocumentPosition(trousers)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(trousers.compareDocumentPosition(bag)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("does not duplicate the outfit title inside the mobile body", () => {
    setViewportMobile(true);

    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "modified",
        effective: { items: [] },
      },
    });

    expect(
      screen.queryByRole("button", { name: "Rename capsule Test outfit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add items" }),
    ).toBeInTheDocument();
  });

  test("opens the outfit item long-press menu as a centered mobile preview", () => {
    vi.useFakeTimers();
    setViewportMobile(true);
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });

    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/context-jacket",
              source: "from_catalog",
              item: {
                id: "catalog-1",
                url: "https://example.com/context-jacket",
                name: "Context jacket",
                category: "outerwear",
                imageUrl: "https://example.com/context-jacket.png",
              },
            },
          ],
        },
      },
    });

    const card = screen.getByRole("button", { name: /Context jacket/i });
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      top: 24,
      left: 16,
      width: 150,
      height: 210,
      right: 166,
      bottom: 234,
      x: 16,
      y: 24,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(card, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 24,
      clientY: 32,
    });
    act(() => {
      vi.advanceTimersByTime(520);
    });

    expect(vibrate).toHaveBeenCalledWith(10);
    const dialog = screen.getByRole("dialog", { name: "Open product menu" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Context jacket")).toBeInTheDocument();
    expect(screen.getAllByText("Select")).toHaveLength(1);

    fireEvent.click(screen.getByText("Select"));

    expect(screen.getByRole("button", { name: "Select" })).toBeVisible();
    expect(screen.getByTestId("CheckRoundedIcon")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ThumbDownAltOutlinedIcon"),
    ).not.toBeInTheDocument();
  });

  test("shows mobile card layout controls and updates outfit columns", async () => {
    setViewportMobile(true);
    window.localStorage.removeItem("outfit.mobileCardColumns");
    const user = userEvent.setup();
    const { container } = renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Test outfit",
        status: "saved",
        effective: {
          items: [
            {
              url: "https://example.com/uploaded",
              source: "uploaded",
              item: {
                id: 42,
                url: "https://example.com/uploaded",
                name: "Uploaded jacket",
                category: "outerwear",
                imageUrl: "https://example.com/uploaded.png",
                source: "uploaded",
              },
            },
          ],
        },
      },
    });

    await screen.findByRole("button", { name: /Uploaded jacket/i });
    expect(container.querySelector(".wardrobe-card-root")).toHaveAttribute(
      "data-mobile-columns",
      "2",
    );

    await user.click(screen.getByRole("button", { name: "Open actions" }));

    expect(screen.getByText("Card layout")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3 columns" }));

    expect(container.querySelector(".wardrobe-card-root")).toHaveAttribute(
      "data-mobile-columns",
      "3",
    );
    expect(window.localStorage.getItem("outfit.mobileCardColumns")).toBe("3");
  });

  test("runs simple outfit-level menu actions", async () => {
    const user = userEvent.setup();
    const onDownloadOutfitPdf = vi.fn(() => Promise.resolve());
    const onDuplicateOutfit = vi.fn(() => Promise.resolve());
    const onSaveOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: { items: [] },
      },
      onDownloadOutfitPdf,
      onDuplicateOutfit,
      onSaveOutfit,
    });

    await expectNoBrowserConfirm(async () => {
      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Export PDF" }));
      expect(onDownloadOutfitPdf).toHaveBeenCalledWith("outfit-1");

      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Save" }));
      expect(onSaveOutfit).toHaveBeenCalledWith("outfit-1");

      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Save as" }));
      expect(onDuplicateOutfit).toHaveBeenCalledWith("Weekend", "outfit-1");
    });
  });

  test("pins and unpins an outfit from the outfit-level menu", async () => {
    const user = userEvent.setup();
    const onSetOutfitPin = vi.fn(() => Promise.resolve());
    const activeOutfit = {
      id: "outfit-1",
      name: "Weekend",
      status: "saved",
      effective: { items: [] },
    };
    renderScreen({
      activeOutfit,
      onSetOutfitPin,
    });

    await expectNoBrowserConfirm(async () => {
      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Pin outfit" }));
      expect(onSetOutfitPin).toHaveBeenCalledWith("outfit-1", true);

      cleanup();
      renderScreen({
        activeOutfit: { ...activeOutfit, pin: true },
        onSetOutfitPin,
      });

      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Unpin outfit" }));
      expect(onSetOutfitPin).toHaveBeenLastCalledWith("outfit-1", false);
    });
  });

  test("renames an outfit from the outfit-level menu", async () => {
    const user = userEvent.setup();
    const onRenameOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: { items: [] },
      },
      onRenameOutfit,
    });

    await expectNoBrowserConfirm(async () => {
      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));
      const renameDialog = screen.getByRole("dialog", {
        name: "Rename outfit",
      });
      const renameInput = within(renameDialog).getByRole("textbox", {
        name: "Rename outfit",
      });
      expect(renameInput).toHaveValue("Weekend");
      fireEvent.change(renameInput, { target: { value: "Desktop outfit" } });
      await user.click(
        within(renameDialog).getByRole("button", { name: "OK" }),
      );
      await waitFor(() =>
        expect(onRenameOutfit).toHaveBeenCalledWith(
          "Desktop outfit",
          "outfit-1",
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Rename outfit" }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  test("confirms or cancels outfit revert from the outfit-level menu", async () => {
    const user = userEvent.setup();
    const onRevertOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: { items: [] },
      },
      onRevertOutfit,
    });

    await expectNoBrowserConfirm(async () => {
      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Revert" }));
      expect(
        screen.getByRole("dialog", { name: "Revert changes" }),
      ).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(onRevertOutfit).not.toHaveBeenCalled();

      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Revert" }));
      const revertDialog = screen.getByRole("dialog", {
        name: "Revert changes",
      });
      expect(
        within(revertDialog).getByText("Discard unsaved changes?"),
      ).toBeVisible();
      await user.click(
        within(revertDialog).getByRole("button", { name: "Revert" }),
      );
      expect(onRevertOutfit).toHaveBeenCalledWith("outfit-1");
    });
  });

  test("confirms outfit delete from the outfit-level menu", async () => {
    const user = userEvent.setup();
    const onDeleteOutfit = vi.fn(() => Promise.resolve());
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: { items: [] },
      },
      onDeleteOutfit,
    });

    await expectNoBrowserConfirm(async () => {
      await openOutfitActions(user);
      await user.click(screen.getByRole("menuitem", { name: "Delete" }));
      const deleteDialog = screen.getByRole("dialog", {
        name: "Delete outfit",
      });
      expect(
        within(deleteDialog).getByText(
          "Are you sure you want to delete this outfit?",
        ),
      ).toBeVisible();
      await user.click(
        within(deleteDialog).getByRole("button", { name: "Delete" }),
      );
      expect(onDeleteOutfit).toHaveBeenCalledWith("outfit-1");
    });
  });

  test("adds a selected personal item to the current outfit", async () => {
    personalItemsApi.fetchPersonalItems.mockResolvedValue({
      items: [
        {
          id: 42,
          url: "https://example.com/personal",
          name: "Personal shirt",
          category: "top",
          imageUrl: "https://example.com/personal.png",
          source: "uploaded",
          isLiked: true,
        },
        {
          id: 43,
          url: "https://example.com/existing",
          name: "Existing shirt",
          category: "top",
          imageUrl: "https://example.com/existing.png",
          source: "from_catalog",
        },
      ],
    });
    const onReplaceOutfitItems = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    renderScreen({
      activeOutfit: {
        id: "outfit-1",
        name: "Weekend",
        status: "modified",
        effective: {
          items: [
            {
              url: "https://example.com/existing",
              source: "from_catalog",
              item: {
                id: 43,
                url: "https://example.com/existing",
                name: "Existing shirt",
                category: "top",
              },
            },
          ],
        },
      },
      onReplaceOutfitItems,
    });

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(
      await screen.findByRole("button", { name: /Personal shirt/i }),
    );

    expect(screen.getByText("1 personal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onReplaceOutfitItems).toHaveBeenCalledWith("outfit-1", [
      expect.objectContaining({
        url: "https://example.com/existing",
        source: "from_catalog",
      }),
      expect.objectContaining({
        url: "wardrobe://42",
        source: "uploaded",
      }),
    ]);
  });

  test("opens the add items dialog fullscreen on mobile", async () => {
    setViewportMobile(true);
    personalItemsApi.fetchPersonalItems.mockResolvedValue({ items: [] });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    expect(screen.getByRole("dialog", { name: /Add items/ })).toHaveClass(
      "MuiDialog-paperFullScreen",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Add items/ }),
      ).not.toBeInTheDocument();
    });
  });

  test("shows catalog filters, search, total, and picker cards in add dialog", async () => {
    mockCatalogSearch();

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(screen.getByRole("tab", { name: "Catalog" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchOptions).toHaveBeenCalledTimes(1);
      expect(searchApi.runSearch).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, persist: false }),
      );
    });

    expect(screen.getAllByText("Filters")).not.toHaveLength(0);
    expect(screen.getByText("Liked only")).toBeInTheDocument();
    expect(screen.getByText("Brand")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search in natural language"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 results")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Catalog jacket/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Search in natural language"),
      "linen{Enter}",
    );

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 20, persist: false, query: "linen" }),
      );
    });
  });

  test("keeps the catalog query chip on the last applied search while typing", async () => {
    mockCatalogSearch();

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));
    await user.click(screen.getByRole("tab", { name: "Catalog" }));
    await screen.findByText("1 results");
    searchApi.runSearch.mockClear();

    const searchInput = screen.getByPlaceholderText(
      "Search in natural language",
    );
    await user.type(searchInput, "linen");

    expect(searchInput).toHaveValue("linen");
    expect(screen.queryByText("Search: linen")).not.toBeInTheDocument();
    expect(searchApi.runSearch).not.toHaveBeenCalled();

    await user.type(searchInput, "{Enter}");

    await waitFor(() => {
      expect(screen.getByText("Search: linen")).toBeInTheDocument();
      expect(searchApi.runSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 20, persist: false, query: "linen" }),
      );
    });

    await user.clear(searchInput);
    await user.type(searchInput, "silk");

    expect(screen.getByText("Search: linen")).toBeInTheDocument();
    expect(screen.queryByText("Search: silk")).not.toBeInTheDocument();
  });

  test("uses the colocated 320 thumbnail for uploaded personal items in the add dialog", async () => {
    const imageUrl =
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/6f6172c0-de05-4782-b2c1-0e90291f4eea-5ddb4e96b2b825e06d19bc887f32e61e7a5e0fa9d92deea0c3adc4feebb30828.webp";
    personalItemsApi.fetchPersonalItems.mockResolvedValue({
      items: [
        {
          id: 42,
          url: "https://example.com/original-product-page",
          name: "Uploaded jacket",
          category: "outerwear",
          imageUrl,
          source: "uploaded",
        },
      ],
    });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    const image = await screen.findByRole("img", {
      name: "Uploaded jacket",
    });
    expect(image).toHaveAttribute(
      "src",
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/6f6172c0-de05-4782-b2c1-0e90291f4eea-5ddb4e96b2b825e06d19bc887f32e61e7a5e0fa9d92deea0c3adc4feebb30828_320.webp",
    );
    expect(image).not.toHaveAttribute("srcset");
  });

  test("does not infer personal item source from wardrobe-looking image URLs", async () => {
    const imageUrl =
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/catalog-looking.webp";
    personalItemsApi.fetchPersonalItems.mockResolvedValue({
      items: [
        {
          id: 43,
          url: "https://example.com/original-product-page",
          name: "Catalog-backed personal item",
          category: "outerwear",
          imageUrl,
          source: "from_catalog",
        },
      ],
    });

    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Add items" }));

    const image = await screen.findByRole("img", {
      name: "Catalog-backed personal item",
    });
    expect(image).not.toHaveAttribute(
      "src",
      "https://assets.capsule-wardrobe.org/wardrobe/f2641a1885a7ae72/catalog-looking_320.webp",
    );
  });
});
