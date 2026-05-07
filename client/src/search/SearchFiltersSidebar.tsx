import type { ChangeEvent, KeyboardEvent } from "react";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import {
  clampPriceValue,
  normalizeBrandOption,
  sortAudienceValues,
  sortItemsByLabel,
  sortSeasonValues,
} from "./searchState";
import type { SearchDraftState, SearchOptions } from "./searchState";
import { SearchFiltersSidebarFrame } from "./SearchFiltersSidebarSections";
import type {
  PriceControls,
  SearchFilterItems,
  SearchFiltersSidebarProps,
  SearchStateUpdater,
} from "./SearchFiltersSidebarTypes";

function buildSearchFilterItems(
  options: SearchOptions,
  locale: string,
): SearchFilterItems {
  return {
    brandItems: options.brands.map(normalizeBrandOption).filter(Boolean),
    categoryItems: options.categories.map((item) => ({
      value: item,
      label: translateOption("categories", item, locale),
    })),
    seasonItems: sortSeasonValues(options.seasons).map((item) => ({
      value: item,
      label: translateOption("seasons", item, locale),
    })),
    audienceItems: sortAudienceValues(options.audience).map((item) => ({
      value: item,
      label: translateOption("audience", item, locale),
    })),
    occasionItems: options.occasions.map((item) => ({
      value: item,
      label: translateOption("occasions", item, locale),
    })),
    patternItems: sortItemsByLabel(
      options.patterns.map((item) => ({
        value: item,
        label: translateOption("patterns", item, locale),
      })),
      locale,
    ),
    silhouetteItems: options.silhouettes.map((item) => ({
      value: item,
      label: translateOption("silhouettes", item, locale),
    })),
    fitItems: options.fits.map((item) => ({
      value: item,
      label: translateOption("fits", item, locale),
    })),
    closureTypeItems: options.closureTypes.map((item) => ({
      value: item,
      label: translateOption("closureTypes", item, locale),
    })),
  };
}

function createPriceControls({
  draftState,
  sliderMin,
  sliderMax,
  updateDraftState,
}: {
  draftState: SearchDraftState;
  sliderMin: number;
  sliderMax: number;
  updateDraftState: (
    updater: SearchStateUpdater,
    options?: { submit?: boolean },
  ) => void;
}): PriceControls {
  const priceRange = [
    clampPriceValue(draftState.priceMinDraft, sliderMin, sliderMax),
    clampPriceValue(draftState.priceMaxDraft, sliderMin, sliderMax),
  ];
  const setPriceDraft = (nextValue: number | number[], submit = true) => {
    if (!Array.isArray(nextValue)) {
      return;
    }
    updateDraftState(
      (current) => ({
        ...current,
        priceEnabled: true,
        priceMinDraft: nextValue[0],
        priceMaxDraft: nextValue[1],
        page: 1,
      }),
      { submit },
    );
  };
  const handlePriceInputChange =
    (field: "priceMinDraft" | "priceMaxDraft") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      updateDraftState(
        (current) => ({
          ...current,
          priceEnabled: true,
          [field]: event.target.value,
          page: 1,
        }),
        { submit: false },
      );
    };
  const handlePriceInputBlur =
    (field: "priceMinDraft" | "priceMaxDraft") => () => {
      updateDraftState((current) =>
        normalizePriceDraftOnBlur(current, field, sliderMin, sliderMax),
      );
    };
  const handlePriceInputKeyDown =
    (field: "priceMinDraft" | "priceMaxDraft") =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handlePriceInputBlur(field)();
      }
    };

  return {
    sliderMin,
    sliderMax,
    priceRange,
    handlePriceSliderChange: (_event, nextValue) =>
      setPriceDraft(nextValue, false),
    handlePriceSliderCommit: (_event, nextValue) => setPriceDraft(nextValue),
    handlePriceInputChange,
    handlePriceInputBlur,
    handlePriceInputKeyDown,
  };
}

function normalizePriceDraftOnBlur(
  current: SearchDraftState,
  field: "priceMinDraft" | "priceMaxDraft",
  sliderMin: number,
  sliderMax: number,
) {
  const currentMin = clampPriceValue(
    current.priceMinDraft,
    sliderMin,
    sliderMax,
  );
  const currentMax = clampPriceValue(
    current.priceMaxDraft,
    sliderMin,
    sliderMax,
  );
  const nextMin =
    field === "priceMinDraft"
      ? Math.min(
          clampPriceValue(current.priceMinDraft, sliderMin, sliderMax),
          currentMax,
        )
      : currentMin;
  const nextMax =
    field === "priceMaxDraft"
      ? Math.max(
          clampPriceValue(current.priceMaxDraft, sliderMin, sliderMax),
          currentMin,
        )
      : currentMax;

  return {
    ...current,
    priceEnabled: true,
    priceMinDraft: Math.min(nextMin, nextMax),
    priceMaxDraft: Math.max(nextMax, nextMin),
    page: 1,
  };
}

function SearchFiltersSidebar(props: SearchFiltersSidebarProps) {
  const { t, locale } = useI18n();
  const sliderMin = props.options.priceRange.min ?? 0;
  const sliderMax = props.options.priceRange.max ?? 1000;
  const updateDraftState = (
    updater: SearchStateUpdater,
    { submit = props.autoApply ?? false } = {},
  ) => {
    props.onDraftStateChange(updater, { submit });
  };

  return (
    <SearchFiltersSidebarFrame
      props={props}
      filterItems={buildSearchFilterItems(props.options, locale)}
      priceControls={createPriceControls({
        draftState: props.draftState,
        sliderMin,
        sliderMax,
        updateDraftState,
      })}
      updateDraftState={updateDraftState}
      t={t}
      locale={locale}
    />
  );
}

export default SearchFiltersSidebar;
