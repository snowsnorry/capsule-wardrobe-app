import type {
  ActiveFilterChip,
  SearchDraftState,
  SearchOptions,
  SearchTranslator,
} from "./searchStateTypes";

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
  pushSearchFacetChips(chips, {
    state,
    options,
    locale,
    t,
    translateOption,
  });

  if (state.priceEnabled) {
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
  const pushFacetChips = (
    values: string[],
    title: string,
    optionGroup: string,
    fieldKey: keyof SearchDraftState,
  ) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }

    const labelValues = values.map((value) =>
      getFacetLabel({
        value,
        optionGroup,
        options,
        locale,
        translateOption,
      }),
    );

    chips.push({
      key: `${fieldKey}:${values.join(",")}`,
      field: fieldKey,
      values,
      label: `${title}: ${labelValues.join(", ")}`,
    });
  };

  pushFacetChips(state.brand, t("search.filters.brand"), "brand", "brand");
  pushFacetChips(
    state.audience,
    t("profile.audienceTitle"),
    "audience",
    "audience",
  );
  pushFacetChips(
    state.category,
    t("search.filters.category"),
    "categories",
    "category",
  );
  pushFacetChips(state.season, t("profile.seasonsTitle"), "seasons", "season");
  pushFacetChips(
    state.formalityLevel,
    t("statistics.charts.formalityLevel"),
    "styles",
    "formalityLevel",
  );
  pushFacetChips(state.style, t("statistics.charts.style"), "styles", "style");
  pushFacetChips(
    state.occasions,
    t("profile.occasionsTitle"),
    "occasions",
    "occasions",
  );
  pushFacetChips(
    state.color,
    t("profile.accentColorTitle"),
    "accentColors",
    "color",
  );
  pushFacetChips(
    state.pattern,
    t("profile.patternTitle"),
    "patterns",
    "pattern",
  );
  pushFacetChips(
    state.silhouette,
    t("search.filters.silhouette"),
    "silhouettes",
    "silhouette",
  );
  pushFacetChips(state.fit, t("search.filters.fit"), "fits", "fit");
  pushFacetChips(
    state.closureType,
    t("search.filters.closureType"),
    "closureTypes",
    "closureType",
  );
}
