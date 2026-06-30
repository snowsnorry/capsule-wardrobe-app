type TranslateOption = (group: string, value: string, locale: string) => string;
type Translate = (
  key: string,
  params?: Record<string, unknown>,
  locale?: string,
) => string;
type ProductDetailItem = {
  price?: unknown;
  currency?: unknown;
  availability?: string;
  audience?: string;
  season?: unknown;
  formalityLevel?: unknown;
  style?: unknown;
  occasions?: unknown;
  colorBase?: unknown;
  pattern?: string;
  finish?: unknown;
  isNeutral?: unknown;
  composition?: unknown;
  silhouette?: string;
  fit?: string;
  closureType?: unknown;
};
type TextDetailValue = {
  kind: "text";
  text: string;
};
type ColorDetailValue = {
  kind: "colors";
  items: {
    key: string;
    label: string;
  }[];
};
type DetailValue = TextDetailValue | ColorDetailValue;
type DetailRow = {
  key: string;
  label: string;
  value: DetailValue;
};
type PendingDetailRow = Omit<DetailRow, "value"> & {
  value: DetailValue | null;
};
type ProductDetailContext = {
  t: Translate;
  translateOption: TranslateOption;
  locale: string;
};
type DetailField = {
  key: string;
  labelKey: string;
  resolveValue: (
    item: ProductDetailItem | null | undefined,
    context: ProductDetailContext,
  ) => DetailValue | null;
};

const detailGroups = [
  { id: "meta", keys: ["price", "availability", "audience", "season"] },
  {
    id: "style",
    keys: [
      "formalityLevel",
      "color",
      "style",
      "pattern",
      "occasions",
      "neutral",
    ],
  },
  {
    id: "construction",
    keys: ["composition", "finish", "silhouette", "fit", "closureType"],
  },
] as const;

function translateComposition(
  value: unknown,
  translateOption: TranslateOption,
  locale: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => translateOption("materials", part.toLowerCase(), locale))
    .join(", ");
}

function createTextValue(value: unknown): TextDetailValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? { kind: "text", text: normalized } : null;
}

function createListValue(
  values: readonly unknown[] = [],
): TextDetailValue | null {
  const items = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return items.length > 0 ? { kind: "text", text: items.join(", ") } : null;
}

function createColorValue(
  values: readonly unknown[] = [],
  translateOption: TranslateOption,
  locale: string,
): ColorDetailValue | null {
  const items = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => ({
      key: value,
      label: translateOption("accentColors", value, locale),
    }));

  return items.length > 0 ? { kind: "colors", items } : null;
}

function translateArrayField(
  values: unknown,
  optionGroup: string,
  { translateOption, locale }: ProductDetailContext,
): TextDetailValue | null {
  return createListValue(
    Array.isArray(values)
      ? values.map((value) =>
          translateOption(optionGroup, String(value), locale),
        )
      : [],
  );
}

const detailFields: readonly DetailField[] = [
  {
    key: "price",
    labelKey: "search.fields.price",
    resolveValue: (item) =>
      createTextValue(
        item?.price != null
          ? `${item.price}${item.currency ? ` ${item.currency}` : ""}`
          : null,
      ),
  },
  {
    key: "availability",
    labelKey: "search.fields.availability",
    resolveValue: (item, context) =>
      createTextValue(
        item?.availability
          ? context.translateOption(
              "availability",
              item.availability,
              context.locale,
            )
          : null,
      ),
  },
  {
    key: "audience",
    labelKey: "search.fields.audience",
    resolveValue: (item, context) =>
      createTextValue(
        item?.audience
          ? context.translateOption("audience", item.audience, context.locale)
          : null,
      ),
  },
  {
    key: "season",
    labelKey: "search.fields.season",
    resolveValue: (item, context) =>
      translateArrayField(item?.season, "seasons", context),
  },
  {
    key: "formalityLevel",
    labelKey: "search.fields.formalityLevel",
    resolveValue: (item, context) =>
      translateArrayField(item?.formalityLevel, "styles", context),
  },
  {
    key: "style",
    labelKey: "search.fields.style",
    resolveValue: (item, context) =>
      translateArrayField(item?.style, "styles", context),
  },
  {
    key: "occasions",
    labelKey: "search.fields.occasions",
    resolveValue: (item, context) =>
      translateArrayField(item?.occasions, "occasions", context),
  },
  {
    key: "color",
    labelKey: "search.fields.color",
    resolveValue: (item, context) =>
      createColorValue(
        Array.isArray(item?.colorBase) ? item.colorBase : [],
        context.translateOption,
        context.locale,
      ),
  },
  {
    key: "pattern",
    labelKey: "search.fields.pattern",
    resolveValue: (item, context) =>
      createTextValue(
        item?.pattern
          ? context.translateOption("patterns", item.pattern, context.locale)
          : null,
      ),
  },
  {
    key: "finish",
    labelKey: "search.fields.finish",
    resolveValue: (item, context) =>
      createTextValue(
        item?.finish
          ? context.translateOption(
              "finishes",
              String(item.finish),
              context.locale,
            )
          : null,
      ),
  },
  {
    key: "neutral",
    labelKey: "search.fields.neutral",
    resolveValue: (item, context) =>
      typeof item?.isNeutral === "boolean"
        ? createTextValue(
            item.isNeutral ? context.t("search.yes") : context.t("search.no"),
          )
        : null,
  },
  {
    key: "composition",
    labelKey: "search.fields.composition",
    resolveValue: (item, context) =>
      createTextValue(
        item?.composition
          ? translateComposition(
              item.composition,
              context.translateOption,
              context.locale,
            )
          : null,
      ),
  },
  {
    key: "silhouette",
    labelKey: "search.fields.silhouette",
    resolveValue: (item, context) =>
      createTextValue(
        item?.silhouette
          ? context.translateOption(
              "silhouettes",
              item.silhouette,
              context.locale,
            )
          : null,
      ),
  },
  {
    key: "fit",
    labelKey: "search.fields.fit",
    resolveValue: (item, context) =>
      createTextValue(
        item?.fit
          ? context.translateOption("fits", item.fit, context.locale)
          : null,
      ),
  },
  {
    key: "closureType",
    labelKey: "search.fields.closureType",
    resolveValue: (item, context) =>
      translateArrayField(item?.closureType, "closureTypes", context),
  },
];

function buildProductDetailGroups(
  item: ProductDetailItem | null | undefined,
  context: ProductDetailContext,
) {
  const detailRows: DetailRow[] = detailFields
    .map((field): PendingDetailRow => ({
      key: field.key,
      label: context.t(field.labelKey),
      value: field.resolveValue(item, context),
    }))
    .filter((row): row is DetailRow => Boolean(row.value));

  const getRows = (keys: readonly string[]): DetailRow[] =>
    keys
      .map((key) => detailRows.find((row) => row.key === key))
      .filter((row): row is DetailRow => Boolean(row));

  return detailGroups
    .map((group) => ({ id: group.id, items: getRows(group.keys) }))
    .filter((group) => group.items.length > 0);
}

export { buildProductDetailGroups };
