type TranslateOption = (group: string, value: string, locale: string) => string;
type Translate = (key: string, params?: Record<string, unknown>, locale?: string) => string;
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

function translateComposition(value: unknown, translateOption: TranslateOption, locale: string): unknown {
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

function createListValue(values: readonly unknown[] = []): TextDetailValue | null {
  const items = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return items.length > 0 ? { kind: "text", text: items.join(", ") } : null;
}

function createColorValue(
  values: readonly unknown[] = [],
  translateOption: TranslateOption,
  locale: string
): ColorDetailValue | null {
  const items = values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => ({
      key: value,
      label: translateOption("accentColors", value, locale)
    }));

  return items.length > 0 ? { kind: "colors", items } : null;
}

function buildProductDetailGroups(
  item: ProductDetailItem | null | undefined,
  { t, translateOption, locale }: { t: Translate; translateOption: TranslateOption; locale: string }
) {
  const detailRows: DetailRow[] = ([
    {
      key: "price",
      label: t("search.fields.price"),
      value: createTextValue(item?.price != null ? `${item.price}${item.currency ? ` ${item.currency}` : ""}` : null)
    },
    {
      key: "availability",
      label: t("search.fields.availability"),
      value: createTextValue(item?.availability ? translateOption("availability", item.availability, locale) : null)
    },
    {
      key: "audience",
      label: t("search.fields.audience"),
      value: createTextValue(item?.audience ? translateOption("audience", item.audience, locale) : null)
    },
    {
      key: "season",
      label: t("search.fields.season"),
      value: createListValue(
        Array.isArray(item?.season) ? item.season.map((value) => translateOption("seasons", value, locale)) : []
      )
    },
    {
      key: "formalityLevel",
      label: t("search.fields.formalityLevel"),
      value: createListValue(
        Array.isArray(item?.formalityLevel)
          ? item.formalityLevel.map((value) => translateOption("styles", value, locale))
          : []
      )
    },
    {
      key: "style",
      label: t("search.fields.style"),
      value: createListValue(
        Array.isArray(item?.style) ? item.style.map((value) => translateOption("styles", value, locale)) : []
      )
    },
    {
      key: "occasions",
      label: t("search.fields.occasions"),
      value: createListValue(
        Array.isArray(item?.occasions)
          ? item.occasions.map((value) => translateOption("occasions", value, locale))
          : []
      )
    },
    {
      key: "color",
      label: t("search.fields.color"),
      value: createColorValue(Array.isArray(item?.colorBase) ? item.colorBase : [], translateOption, locale)
    },
    {
      key: "pattern",
      label: t("search.fields.pattern"),
      value: createTextValue(item?.pattern ? translateOption("patterns", item.pattern, locale) : null)
    },
    {
      key: "finish",
      label: t("search.fields.finish"),
      value: createTextValue(item?.finish)
    },
    {
      key: "neutral",
      label: t("search.fields.neutral"),
      value: typeof item?.isNeutral === "boolean" ? createTextValue(item.isNeutral ? t("search.yes") : t("search.no")) : null
    },
    {
      key: "composition",
      label: t("search.fields.composition"),
      value: createTextValue(item?.composition ? translateComposition(item.composition, translateOption, locale) : null)
    },
    {
      key: "silhouette",
      label: t("search.fields.silhouette"),
      value: createTextValue(item?.silhouette ? translateOption("silhouettes", item.silhouette, locale) : null)
    },
    {
      key: "fit",
      label: t("search.fields.fit"),
      value: createTextValue(item?.fit ? translateOption("fits", item.fit, locale) : null)
    },
    {
      key: "closureType",
      label: t("search.fields.closureType"),
      value: createListValue(
        Array.isArray(item?.closureType)
          ? item.closureType.map((value) => translateOption("closureTypes", value, locale))
          : []
      )
    }
  ] as PendingDetailRow[]).filter((row): row is DetailRow => Boolean(row.value));

  const getRows = (keys: readonly string[]): DetailRow[] => keys
    .map((key) => detailRows.find((row) => row.key === key))
    .filter((row): row is DetailRow => Boolean(row));

  return [
    {
      id: "meta",
      items: getRows(["price", "availability", "audience", "season"])
    },
    {
      id: "style",
      items: getRows(["formalityLevel", "color", "style", "pattern", "occasions", "neutral"])
    },
    {
      id: "construction",
      items: getRows(["composition", "finish", "silhouette", "fit", "closureType"])
    }
  ].filter((group) => group.items.length > 0);
}

export { buildProductDetailGroups, translateComposition };
