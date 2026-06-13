import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import {
  createSearchState,
  serializeDraftState,
} from "../../search/searchState";
import {
  CATALOG_PICKER_PAGE_SIZE,
  getAppliedCatalogSearchState,
  getCatalogMobileFiltersDraft,
  getResetCatalogSearchState,
  mergeSelectedSnapshots,
  useOutfitAddItemsDialog,
} from "./useOutfitAddItemsDialog";

function makeCatalogOptions() {
  return {
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
  };
}

function t(key: string) {
  return key;
}

function HookHarness() {
  const model = useOutfitAddItemsDialog({
    existingItems: [],
    initialItems: [],
    locale: "en",
    maxSelected: null,
    open: false,
    t,
  });

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          model.changeCatalogMobileFiltersDraft((current) => ({
            ...current,
            likedOnly: true,
          })),
      },
      "change mobile draft",
    ),
    React.createElement(
      "span",
      { "data-testid": "mobile-liked" },
      String(model.catalogMobileFiltersDraftState.likedOnly),
    ),
  );
}

afterEach(() => {
  cleanup();
});

describe("mergeSelectedSnapshots", () => {
  test("keeps existing outfit order while appending new personal and catalog selections", () => {
    const existingCatalog: OutfitItemSnapshot = {
      url: "https://example.com/existing",
      source: "from_catalog",
      item: { name: "Existing shirt" },
    };
    const selectedPersonal: OutfitItemSnapshot = {
      url: "wardrobe://42",
      source: "uploaded",
      item: { name: "Personal shirt" },
    };
    const selectedCatalog: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Catalog bag" },
    };

    expect(
      mergeSelectedSnapshots(
        [selectedPersonal, selectedCatalog, existingCatalog],
        [existingCatalog],
      ),
    ).toEqual([existingCatalog, selectedPersonal, selectedCatalog]);
  });

  test("deduplicates by source and URL while preserving the initial item object", () => {
    const staleInitial: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Initial bag" },
    };
    const duplicateSelection: OutfitItemSnapshot = {
      url: "https://example.com/bag",
      source: "from_catalog",
      item: { name: "Selected bag" },
    };

    expect(
      mergeSelectedSnapshots([duplicateSelection], [staleInitial]),
    ).toEqual([staleInitial]);
  });
});

describe("catalog mobile filter state helpers", () => {
  test("keeps mobile catalog filter draft local when closed", async () => {
    const options = makeCatalogOptions();
    const catalogDraftState = createSearchState(null, options.priceRange);
    const editedMobileDraft = {
      ...getCatalogMobileFiltersDraft(catalogDraftState),
      likedOnly: true,
    };

    expect(editedMobileDraft.likedOnly).toBe(true);
    expect(catalogDraftState.likedOnly).toBe(false);
    expect(getCatalogMobileFiltersDraft(catalogDraftState).likedOnly).toBe(
      false,
    );
  });

  test("applies and resets mobile catalog filter payloads", async () => {
    const options = makeCatalogOptions();
    const mobileDraft = {
      ...createSearchState(null, options.priceRange),
      likedOnly: true,
      page: 4,
    };

    const appliedState = getAppliedCatalogSearchState(mobileDraft);
    expect({
      ...serializeDraftState(appliedState, options.priceRange),
      limit: CATALOG_PICKER_PAGE_SIZE,
      persist: false,
    }).toEqual(
      expect.objectContaining({
        likedOnly: true,
        limit: 20,
        page: 1,
        persist: false,
      }),
    );

    const resetState = getResetCatalogSearchState(options);
    expect({
      ...serializeDraftState(resetState, options.priceRange),
      limit: CATALOG_PICKER_PAGE_SIZE,
      persist: false,
    }).toEqual(
      expect.objectContaining({
        likedOnly: false,
        limit: 20,
        page: 1,
        persist: false,
      }),
    );
  });
});

describe("useOutfitAddItemsDialog", () => {
  test("updates the mobile filters draft through the hook callback", () => {
    render(React.createElement(HookHarness));

    fireEvent.click(
      screen.getByRole("button", { name: "change mobile draft" }),
    );

    expect(screen.getByTestId("mobile-liked")).toHaveTextContent("true");
  });
});
