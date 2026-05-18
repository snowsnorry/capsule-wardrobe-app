import {
  normalizeCapsuleSnapshot,
  type CapsuleSnapshot,
} from "../capsuleStoreModel.js";
import type {
  PartialRegenerationJobState,
  WardrobeUiItemLike,
} from "../ai/types.js";
import { e2eImageUrl } from "./fixtures.js";

type WardrobeItemRecord = Record<string, unknown>;

export type SelectedRegenerationSnapshotResult = {
  snapshot: CapsuleSnapshot;
  items: WardrobeItemRecord[];
  selectedItemUrls: string[];
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getWardrobeItems(
  snapshot: CapsuleSnapshot | null,
): WardrobeItemRecord[] {
  const items = snapshot?.data?.wardrobe?.items;
  return Array.isArray(items)
    ? items.filter(
        (item): item is WardrobeItemRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function getItemIdentifier(
  item: WardrobeItemRecord,
  key: "url" | "id",
): string {
  return String(item[key] || "").trim();
}

function normalizeSelectedItemIdentifiers(selectedItems: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(selectedItems) ? selectedItems : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ];
}

function getReplacementLabel(category: string): {
  name: string;
  imageName: string;
  urlSlug: string;
} {
  if (category === "bottom") {
    return {
      name: "E2E Regenerated Trousers",
      imageName: "regenerated-trousers",
      urlSlug: "regenerated-trousers",
    };
  }
  if (category === "shoes") {
    return {
      name: "E2E Regenerated Shoes",
      imageName: "regenerated-shoes",
      urlSlug: "regenerated-shoes",
    };
  }
  return {
    name: "E2E Regenerated Shirt",
    imageName: "regenerated-shirt",
    urlSlug: "regenerated-shirt",
  };
}

function buildDeterministicReplacementItem(
  item: WardrobeItemRecord,
  replacementIndex: number,
): WardrobeItemRecord {
  const category = String(item.category || "top").trim() || "top";
  const label = getReplacementLabel(category);
  const stableIndex = replacementIndex + 1;
  return {
    ...deepClone(item),
    id: `regenerated-${category}-e2e-${stableIndex}`,
    name: label.name,
    brand: "E2E Regenerated",
    url: `https://example.test/products/${label.urlSlug}-${stableIndex}`,
    imageUrl: e2eImageUrl(`${label.imageName}-${stableIndex}`),
    description: `A deterministic e2e regenerated ${category} fixture.`,
  };
}

function getOutfitSetsWithReplacementIds(
  outfitSets: CapsuleSnapshot["data"]["wardrobe"]["outfitSets"],
  replacementIdsByOriginalId: Map<string, string>,
) {
  return outfitSets.map((set) => ({
    ...set,
    itemIds: set.itemIds.map(
      (itemId) => replacementIdsByOriginalId.get(String(itemId)) || itemId,
    ),
  }));
}

function buildRegeneratedItems(
  items: WardrobeItemRecord[],
  selectedIdentifierSet: Set<string>,
) {
  const replacementIdsByOriginalId = new Map<string, string>();
  const selectedItemUrls: string[] = [];
  let replacementIndex = 0;
  let matchedCount = 0;

  const nextItems = items.map((item) => {
    const originalUrl = getItemIdentifier(item, "url");
    const originalId = getItemIdentifier(item, "id");
    const selected =
      selectedIdentifierSet.has(originalUrl) ||
      selectedIdentifierSet.has(originalId);
    if (!selected) return deepClone(item);

    matchedCount += 1;
    if (originalUrl) selectedItemUrls.push(originalUrl);

    const replacement = buildDeterministicReplacementItem(
      item,
      replacementIndex,
    );
    replacementIndex += 1;

    if (originalId) {
      replacementIdsByOriginalId.set(
        originalId,
        getItemIdentifier(replacement, "id"),
      );
    }
    return replacement;
  });

  return {
    matchedCount,
    nextItems,
    replacementIdsByOriginalId,
    selectedItemUrls,
  };
}

function canRegenerateSelectedItems({
  snapshot,
  wardrobe,
  items,
  selectedIdentifiers,
}: {
  snapshot: CapsuleSnapshot | null;
  wardrobe: CapsuleSnapshot["data"]["wardrobe"];
  items: WardrobeItemRecord[];
  selectedIdentifiers: string[];
}): boolean {
  return Boolean(
    snapshot && wardrobe && items.length > 0 && selectedIdentifiers.length > 0,
  );
}

export function buildSnapshotWithSelectedRegeneration(
  snapshot: CapsuleSnapshot | null,
  selectedItems: unknown,
): SelectedRegenerationSnapshotResult | null {
  const wardrobe = snapshot?.data?.wardrobe;
  const items = getWardrobeItems(snapshot);
  const selectedIdentifiers = normalizeSelectedItemIdentifiers(selectedItems);
  if (
    !canRegenerateSelectedItems({
      snapshot,
      wardrobe,
      items,
      selectedIdentifiers,
    })
  ) {
    return null;
  }

  const regenerated = buildRegeneratedItems(
    items,
    new Set(selectedIdentifiers),
  );
  if (regenerated.matchedCount !== selectedIdentifiers.length) {
    return null;
  }

  const nextSnapshot = normalizeCapsuleSnapshot({
    filters: snapshot.filters,
    data: {
      wardrobe: {
        ...wardrobe,
        items: regenerated.nextItems,
        outfitSets: getOutfitSetsWithReplacementIds(
          wardrobe.outfitSets,
          regenerated.replacementIdsByOriginalId,
        ),
      },
      rejectedUrls: [
        ...new Set([
          ...(snapshot.data?.rejectedUrls || []),
          ...regenerated.selectedItemUrls,
        ]),
      ],
      regeneration: snapshot.data?.regeneration || null,
    },
  });

  return nextSnapshot
    ? {
        snapshot: nextSnapshot,
        items: deepClone(regenerated.nextItems),
        selectedItemUrls: regenerated.selectedItemUrls,
      }
    : null;
}

export class E2eSelectedRegenerationMemory {
  private counter = 0;
  private jobs = new Map<string, PartialRegenerationJobState>();

  reset(): void {
    this.counter = 0;
    this.jobs.clear();
  }

  getJob(
    email: unknown,
    capsuleId: unknown,
  ): PartialRegenerationJobState | null {
    return this.jobs.get(this.getJobKey(email, capsuleId)) || null;
  }

  recordCompletedJob({
    email,
    capsuleId,
    pendingItemUrls,
    items,
  }: {
    email: unknown;
    capsuleId: unknown;
    pendingItemUrls: string[];
    items: WardrobeUiItemLike[];
  }): PartialRegenerationJobState {
    this.counter += 1;
    const job: PartialRegenerationJobState = {
      capsuleRequestId: `e2e-partial-regeneration-${this.counter}`,
      status: "completed",
      phase: "completed",
      startedAt: this.counter,
      updatedAt: this.counter,
      pendingItemUrls,
      result: {
        items,
        outfitSets: [],
        rawSelectionText: "Mocked e2e selected regeneration response",
        swimwearReasoning: null,
        swimwearRawSelectionText: null,
      },
      promise: null,
    };
    this.jobs.set(this.getJobKey(email, capsuleId), job);
    return job;
  }

  private getJobKey(email: unknown, capsuleId: unknown): string {
    return `${String(email || "")
      .trim()
      .toLowerCase()}::${String(capsuleId || "").trim()}`;
  }
}
