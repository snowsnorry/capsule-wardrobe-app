import {
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_CLOSURE_TYPE_OPTIONS,
  PRODUCT_COLOR_BASE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_FIT_OPTIONS,
  PRODUCT_FORMALITY_LEVEL_OPTIONS,
  PRODUCT_MATERIAL_OPTIONS,
  PRODUCT_OCCASION_OPTIONS,
  PRODUCT_PATTERN_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  PRODUCT_SILHOUETTE_OPTIONS,
  PRODUCT_STYLE_OPTIONS,
} from "../../../../shared/productMetadataOptions.js";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import type { ProductDetailItem } from "./ProductDetailModel";

type UploadedProductFormState = UploadedWardrobeItemUpdatePayload & {
  compositionValues: string[];
};

function buildFormState(
  item: ProductDetailItem | null,
): UploadedProductFormState {
  const compositionValues = getOptionArrayValue(
    item?.composition,
    PRODUCT_MATERIAL_OPTIONS,
  );

  return {
    ...buildTextFormState(item),
    ...buildOptionFormState(item, compositionValues),
  };
}

function buildTextFormState(item: ProductDetailItem | null) {
  return {
    name: getStringValue(item?.name),
    description: nullableText(item?.description),
    brand: nullableText(item?.brand),
  };
}

function buildOptionFormState(
  item: ProductDetailItem | null,
  compositionValues: string[],
) {
  return {
    audience: normalizeAudienceValue(item?.audience),
    category: getOptionValue(item?.category, PRODUCT_CATEGORY_OPTIONS) || "",
    season: getOptionArrayValue(item?.season, PRODUCT_SEASON_OPTIONS),
    formalityLevel: getOptionArrayValue(
      getFirstItemValue(item, "formalityLevel"),
      PRODUCT_FORMALITY_LEVEL_OPTIONS,
    ),
    style: getOptionArrayValue(item?.style, PRODUCT_STYLE_OPTIONS),
    occasions: getOptionArrayValue(item?.occasions, PRODUCT_OCCASION_OPTIONS),
    colorBase: getOptionArrayValue(
      getFirstItemValue(item, "colorBase"),
      PRODUCT_COLOR_BASE_OPTIONS,
    ),
    pattern: getOptionValue(item?.pattern, PRODUCT_PATTERN_OPTIONS),
    finish: getOptionValue(item?.finish, PRODUCT_FINISH_OPTIONS),
    composition:
      compositionValues.length > 0 ? compositionValues.join(", ") : null,
    compositionValues,
    silhouette: getOptionValue(item?.silhouette, PRODUCT_SILHOUETTE_OPTIONS),
    fit: getOptionValue(item?.fit, PRODUCT_FIT_OPTIONS),
    closureType: getOptionArrayValue(
      getFirstItemValue(item, "closureType"),
      PRODUCT_CLOSURE_TYPE_OPTIONS,
    ),
  };
}

function buildPayload(
  form: UploadedProductFormState,
): UploadedWardrobeItemUpdatePayload {
  const { compositionValues: _compositionValues, ...payload } = form;
  return {
    ...payload,
    name: form.name.trim(),
    description: nullableText(form.description),
    brand: nullableText(form.brand),
    composition:
      form.compositionValues.length > 0
        ? form.compositionValues.join(", ")
        : null,
  };
}

function getMissingRequiredFields(
  form: UploadedProductFormState,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const missing: string[] = [];
  if (!form.name.trim()) {
    missing.push(t("myWardrobe.uploadedDetail.required.name"));
  }
  if (!form.audience) {
    missing.push(t("myWardrobe.uploadedDetail.required.audience"));
  }
  if (!form.category) {
    missing.push(t("myWardrobe.uploadedDetail.required.category"));
  }
  if (form.season.length === 0) {
    missing.push(t("myWardrobe.uploadedDetail.required.season"));
  }
  return missing;
}

function nullableText(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function getStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getFirstItemValue(
  item: ProductDetailItem | null,
  ...keys: Array<keyof ProductDetailItem>
) {
  return keys.map((key) => item?.[key]).find((value) => value !== undefined);
}

function normalizeAudienceValue(value: unknown): string {
  const normalized = getStringValue(value).toLowerCase();
  if (normalized === "unisex") {
    return "all";
  }
  if (normalized === "women") {
    return "woman";
  }
  if (normalized === "men") {
    return "man";
  }
  return normalized;
}

function getOptionValue(
  value: unknown,
  options: readonly string[],
): string | null {
  const normalized = getStringValue(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (options.includes(normalized)) {
    return normalized;
  }

  const underscored = normalized.replace(/[\s-]+/g, "_");
  if (options.includes(underscored)) {
    return underscored;
  }

  const spaced = normalized.replace(/[_-]+/g, " ");
  return options.includes(spaced) ? spaced : null;
}

function getOptionArrayValue(value: unknown, options: readonly string[]) {
  return getArrayValue(value)
    .map((entry) => getOptionValue(entry, options))
    .filter((entry): entry is string => Boolean(entry));
}

function getArrayValue(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [
    ...new Set(
      rawValues.map((entry) => String(entry ?? "").trim()).filter(Boolean),
    ),
  ];
}

export type { UploadedProductFormState };
export { buildFormState, buildPayload, getMissingRequiredFields, nullableText };
