import type { ReactNode } from "react";
import { translateOption } from "../../i18n";
import { sortWardrobeItems } from "../../../../shared/wardrobeOrder.js";
import type {
  CapsuleLike,
  MainScreenItem,
  MobileCardColumns,
  OutfitSetLike,
  ResolvedOutfitSet,
} from "./MainScreenTypes";

const OUTFIT_SET_IMAGE_WIDTH = 896;
const OUTFIT_SET_IMAGE_HEIGHT = 1195;
export const OUTFIT_SET_IMAGE_ASPECT_RATIO = `${OUTFIT_SET_IMAGE_WIDTH} / ${OUTFIT_SET_IMAGE_HEIGHT}`;
export const OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH = OUTFIT_SET_IMAGE_WIDTH / 2;

const MOBILE_CARD_COLUMNS_STORAGE_KEY = "capsule.mobileCardColumns";

export function highlightMatch(
  name: string | undefined,
  query: string | undefined,
): ReactNode {
  const label = String(name || "");
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return label;
  }

  const lower = label.toLowerCase();
  const index = lower.indexOf(normalizedQuery.toLowerCase());
  if (index === -1) {
    return label;
  }

  return (
    <>
      {label.slice(0, index)}
      <strong>{label.slice(index, index + normalizedQuery.length)}</strong>
      {label.slice(index + normalizedQuery.length)}
    </>
  );
}

function getCapsuleSectionLabel(updatedAt: string | undefined) {
  if (!updatedAt) {
    return "searchEarlier";
  }
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return "searchPrevious7Days";
  }
  if (diffDays < 30) {
    return "searchPrevious30Days";
  }
  return "searchEarlier";
}

export function groupCapsules(items: CapsuleLike[] = []) {
  return items.reduce<Record<string, CapsuleLike[]>>((acc, item) => {
    const key = getCapsuleSectionLabel(item.updatedAt);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function capsuleHasUnsavedChanges(
  capsule: CapsuleLike | null | undefined,
) {
  return capsule?.status === "new" || capsule?.status === "modified";
}

function capsuleHasShareableContent(capsule: CapsuleLike | null | undefined) {
  const snapshot = (capsule?.draft || capsule?.saved) as {
    data?: {
      wardrobe?: { items?: unknown[]; regeneration?: unknown } | null;
      regeneration?: unknown;
    };
  } | null;
  const items = snapshot?.data?.wardrobe?.items;
  const regeneration = snapshot?.data?.regeneration;
  return Array.isArray(items) && items.length > 0 && !regeneration;
}

export function capsuleCanRequestShare(
  capsule: CapsuleLike | null | undefined,
  { allowUnknownContent = false } = {},
) {
  if (!capsule?.id) {
    return false;
  }

  if (capsule.draft || capsule.saved) {
    return capsuleHasShareableContent(capsule);
  }

  return allowUnknownContent;
}

export function normalizeCapsuleName(name: string | undefined) {
  return String(name || "").trim();
}

export function resolveOutfitSets(
  items: MainScreenItem[] = [],
  outfitSets: OutfitSetLike[] = [],
): ResolvedOutfitSet[] {
  const itemsById = new Map<string, MainScreenItem>(
    (Array.isArray(items) ? items : [])
      .map((item): [string, MainScreenItem] | null => {
        const id = String(item?.id || "").trim();
        return id ? [id, item] : null;
      })
      .filter((entry): entry is [string, MainScreenItem] => Boolean(entry)),
  );

  return (Array.isArray(outfitSets) ? outfitSets : [])
    .map((set, index) => {
      const resolvedItems = sortWardrobeItems(
        (Array.isArray(set?.itemIds) ? set.itemIds : [])
          .map((id) => itemsById.get(String(id || "").trim()))
          .filter((item): item is MainScreenItem => Boolean(item)),
      );
      return resolvedItems.length >= 3
        ? {
            id: `set-${index + 1}`,
            index,
            label: index + 1,
            items: resolvedItems,
            image:
              typeof set?.image === "string" && set.image.trim().length > 0
                ? set.image.trim()
                : null,
            imageObsolete: Boolean(set?.imageObsolete),
          }
        : null;
    })
    .filter((set): set is ResolvedOutfitSet => Boolean(set));
}

export function resolveOutfitSetImageSrc(
  image: string | null | undefined,
): string {
  const trimmed = String(image || "").trim();
  if (!trimmed) {
    return "";
  }
  return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)
    ? trimmed
    : `data:image/png;base64,${trimmed}`;
}

function resolveStyleSummaryItems({
  selectedStyleCore,
  selectedStyleAesthetic,
  locale,
}: {
  selectedStyleCore: string | null | undefined;
  selectedStyleAesthetic: string | null | undefined;
  locale: string;
}) {
  const styleCore = selectedStyleCore
    ? translateOption("styles", selectedStyleCore, locale)
    : "";
  const styleAesthetic = selectedStyleAesthetic
    ? translateOption("styles", selectedStyleAesthetic, locale)
    : "";

  if (styleCore && styleAesthetic) {
    return [`${styleCore} / ${styleAesthetic}`];
  }

  return styleCore ? [styleCore] : [];
}

function translateOptionalFilterItem(
  namespace: string,
  value: string | null | undefined,
  locale: string,
  shouldInclude = Boolean(value),
) {
  return value && shouldInclude
    ? [translateOption(namespace, value, locale)]
    : [];
}

export function buildCapsuleSummaryItems({
  itemCount,
  outfitCount,
  selectedStyleCore,
  selectedStyleAesthetic,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  selectedAccentColor,
  selectedPattern,
  selectedText,
  locale,
  t,
}: {
  itemCount: number;
  outfitCount: number;
  selectedStyleCore: string | null | undefined;
  selectedStyleAesthetic: string | null | undefined;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string | null | undefined;
  selectedAccentColor: string | null | undefined;
  selectedPattern: string | null | undefined;
  selectedText: string;
  locale: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}): string[] {
  const summary = [
    t("capsule.itemsCount", { count: itemCount }),
    t("capsule.outfitsCount", { count: outfitCount }),
  ];
  summary.push(
    ...resolveStyleSummaryItems({
      selectedStyleCore,
      selectedStyleAesthetic,
      locale,
    }),
  );
  summary.push(
    ...selectedOccasions.map((item) =>
      translateOption("occasions", item, locale),
    ),
  );
  summary.push(
    ...selectedSeasons.map((item) => translateOption("seasons", item, locale)),
  );
  summary.push(
    ...translateOptionalFilterItem(
      "audience",
      selectedAudience,
      locale,
      selectedAudience !== "any",
    ),
  );
  summary.push(
    ...translateOptionalFilterItem("accentColors", selectedAccentColor, locale),
  );
  summary.push(
    ...translateOptionalFilterItem(
      "patterns",
      selectedPattern,
      locale,
      selectedPattern !== "solid",
    ),
  );
  summary.push(...[String(selectedText || "").trim()].filter(Boolean));

  return summary.filter(Boolean);
}

export function isMobileCardColumns(
  value: unknown,
): value is MobileCardColumns {
  return value === 1 || value === 2 || value === 3;
}

export function readStoredMobileCardColumns(): MobileCardColumns {
  if (typeof window === "undefined") {
    return 2;
  }

  const parsed = Number(
    window.localStorage?.getItem(MOBILE_CARD_COLUMNS_STORAGE_KEY),
  );
  return isMobileCardColumns(parsed) ? parsed : 2;
}

export function writeStoredMobileCardColumns(value: MobileCardColumns) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage?.setItem(MOBILE_CARD_COLUMNS_STORAGE_KEY, String(value));
}
