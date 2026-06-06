import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
  SearchTranslator,
} from "./searchStateTypes";
import { isFullPriceRange } from "./searchStateDraft";

function formatSearchPrice(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function getFacetLabel({
  value,
  optionGroup,
  options,
  locale,
  translateOption,
}: {
  value: string;
  optionGroup: string;
  options: SearchOptions;
  locale: string;
  translateOption: (group: string, value: string, locale: string) => string;
}): string {
  if (value === "__other__") {
    return "Other";
  }

  if (optionGroup === "brand") {
    const normalizedSelectedValue = String(value || "")
      .trim()
      .toLowerCase();
    const brand = options.brands.find((item) => {
      const normalizedValue = typeof item === "string" ? item : item?.value;
      return (
        String(normalizedValue || "")
          .trim()
          .toLowerCase() === normalizedSelectedValue
      );
    });
    if (typeof brand === "string") {
      return brand;
    }
    if (brand?.label) {
      return brand.label;
    }
    return value;
  }

  return translateOption(optionGroup, value, locale);
}

export function buildActiveFilterChips({
  state,
  options,
  locale,
  t,
  translateOption,
}: {
  state: SearchDraftState;
  options: SearchOptions;
  locale: string;
  t: SearchTranslator;
  translateOption: (group: string, value: string, locale: string) => string;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (state.likedOnly) {
    chips.push({
      key: "likedOnly:true",
      field: "likedOnly",
      value: "true",
      label: t("search.filters.likedItemsOnly"),
    });
  }
  pushSearchFacetChips(chips, {
    state,
    options,
    locale,
    t,
    translateOption,
  });

  if (
    state.priceEnabled &&
    !isFullPriceRange(
      state.priceMinDraft,
      state.priceMaxDraft,
      options.priceRange,
    )
  ) {
    chips.push({
      key: `price:${state.priceMinDraft}:${state.priceMaxDraft}`,
      field: "price",
      value: `${state.priceMinDraft}:${state.priceMaxDraft}`,
      label: `${t("search.filters.price")}: ${formatSearchPrice(locale, Number(state.priceMinDraft))} - ${formatSearchPrice(locale, Number(state.priceMaxDraft))}`,
    });
  }

  return chips;
}

function pushSearchFacetChips(
  chips: ActiveFilterChip[],
  {
    state,
    options,
    locale,
    t,
    translateOption,
  }: {
    state: SearchDraftState;
    options: SearchOptions;
    locale: string;
    t: SearchTranslator;
    translateOption: (group: string, value: string, locale: string) => string;
  },
) {
  for (const facet of getSearchFacetChipConfigs(state, t)) {
    pushFacetChips(chips, facet, { locale, options, translateOption });
  }
}

function getSearchFacetChipConfigs(
  state: SearchDraftState,
  t: SearchTranslator,
) {
  return [
    {
      values: state.brand,
      title: t("search.filters.brand"),
      optionGroup: "brand",
      field: "brand",
    },
    {
      values: state.audience,
      title: t("profile.audienceTitle"),
      optionGroup: "audience",
      field: "audience",
    },
    {
      values: state.category,
      title: t("search.filters.category"),
      optionGroup: "categories",
      field: "category",
    },
    {
      values: state.season,
      title: t("profile.seasonsTitle"),
      optionGroup: "seasons",
      field: "season",
    },
    {
      values: state.formalityLevel,
      title: t("statistics.charts.formalityLevel"),
      optionGroup: "styles",
      field: "formalityLevel",
    },
    {
      values: state.style,
      title: t("statistics.charts.style"),
      optionGroup: "styles",
      field: "style",
    },
    {
      values: state.occasions,
      title: t("profile.occasionsTitle"),
      optionGroup: "occasions",
      field: "occasions",
    },
    {
      values: state.color,
      title: t("profile.accentColorTitle"),
      optionGroup: "accentColors",
      field: "color",
    },
    {
      values: state.pattern,
      title: t("profile.patternTitle"),
      optionGroup: "patterns",
      field: "pattern",
    },
    {
      values: state.silhouette,
      title: t("search.filters.silhouette"),
      optionGroup: "silhouettes",
      field: "silhouette",
    },
    {
      values: state.fit,
      title: t("search.filters.fit"),
      optionGroup: "fits",
      field: "fit",
    },
    {
      values: state.closureType,
      title: t("search.filters.closureType"),
      optionGroup: "closureTypes",
      field: "closureType",
    },
  ] as Array<{
    field: keyof SearchDraftState;
    optionGroup: string;
    title: string;
    values: string[];
  }>;
}

function pushFacetChips(
  chips: ActiveFilterChip[],
  facet: {
    field: keyof SearchDraftState;
    optionGroup: string;
    title: string;
    values: string[];
  },
  {
    locale,
    options,
    translateOption,
  }: {
    locale: string;
    options: SearchOptions;
    translateOption: (group: string, value: string, locale: string) => string;
  },
) {
  if (!Array.isArray(facet.values) || facet.values.length === 0) return;
  const labelValues = facet.values.map((value) =>
    getFacetLabel({
      value,
      optionGroup: facet.optionGroup,
      options,
      locale,
      translateOption,
    }),
  );
  chips.push({
    key: `${facet.field}:${facet.values.join(",")}`,
    field: facet.field,
    values: facet.values,
    label: `${facet.title}: ${labelValues.join(", ")}`,
  });
}
