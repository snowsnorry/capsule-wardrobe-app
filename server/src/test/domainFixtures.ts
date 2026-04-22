import { getCapsule } from "../capsuleStore.js";
import { getProfile } from "../profileStore.js";
import type {
  GeneratedOutfitSetLike,
  PartialRegenerationJobState,
  ProfileWithItemsLike,
  StoredWardrobePayloadLike,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeJobState,
  WardrobeUiItemLike
} from "../ai/types.js";

type NormalizedProfileRecord = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
type NormalizedCapsuleRecord = NonNullable<Awaited<ReturnType<typeof getCapsule>>>;
type CapsuleSnapshot = NonNullable<NormalizedCapsuleRecord["draft"]>;
type OutfitSet = StoredWardrobePayloadLike["outfitSets"][number];
type WardrobeUiItemFixture = WardrobeUiItemLike & {
  id: string | number;
  url: string;
  name: string;
  category: string;
  image_url: string;
  audience: string;
};

type ProductRowLike = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  brand: string | null;
  price: number | string | null;
  currency: string | null;
  availability: string | null;
  imageUrl: string | null;
  audience: string | null;
  category: string | null;
  season: string[] | null;
  formalityLevel: string[] | null;
  style: string[] | null;
  occasions: string[] | null;
  colorBase: string[] | null;
  pattern: string | null;
  finish: string | null;
  isNeutral: boolean | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closureType: string[] | null;
};

type CapsuleSnapshotOverrides = {
  filters?: Partial<CapsuleSnapshot["filters"]>;
  data?: {
    wardrobe?: StoredWardrobePayloadLike | null;
    rejectedUrls?: string[];
  };
};

function buildNormalizedProfileRecord(
  overrides: Partial<NormalizedProfileRecord> = {}
): NormalizedProfileRecord {
  return {
    email: "person@example.com",
    locale: "en",
    fullname: null,
    activeCapsuleId: null,
    theme: "system",
    llm: "openai:gpt-5.2",
    imageLlm: "openai:gpt-image-2",
    ...overrides
  };
}

function buildWardrobeUiItem(
  overrides: Partial<WardrobeUiItemLike> = {}
): WardrobeUiItemFixture {
  return {
    id: "item-1",
    url: "https://example.com/item-1",
    name: "Item 1",
    category: "top",
    image_url: "https://example.com/item-1.jpg",
    audience: "woman",
    ...overrides
  };
}

function buildGeneratedOutfitSet(
  overrides: Partial<GeneratedOutfitSetLike> = {}
): GeneratedOutfitSetLike {
  return {
    itemIds: ["item-1", "item-2", "item-3"],
    image: null,
    imageObsolete: false,
    ...overrides
  };
}

function buildStoredOutfitSet(
  overrides: Partial<OutfitSet> = {}
): OutfitSet {
  return {
    itemIds: ["item-1", "item-2", "item-3"],
    image: null,
    imageObsolete: false,
    ...overrides
  };
}

function buildStoredWardrobePayload(
  overrides: Partial<StoredWardrobePayloadLike> = {}
): StoredWardrobePayloadLike {
  return {
    items: overrides.items ?? [],
    outfitSets: overrides.outfitSets ?? [],
    reasoning: overrides.reasoning ?? null,
    rawSelectionText: overrides.rawSelectionText ?? null,
    swimwearReasoning: overrides.swimwearReasoning ?? null,
    swimwearRawSelectionText: overrides.swimwearRawSelectionText ?? null
  };
}

function buildWardrobeGenerationResult(
  overrides: Partial<WardrobeGenerationResult> = {}
): WardrobeGenerationResult {
  return {
    items: overrides.items ?? [],
    selectedItems: overrides.selectedItems ?? [],
    outfitSets: overrides.outfitSets ?? [],
    promptEmbeddings: overrides.promptEmbeddings ?? [],
    shortCapsuleName: overrides.shortCapsuleName ?? null,
    reasoning: overrides.reasoning ?? null,
    rawSelectionText: overrides.rawSelectionText ?? null
  };
}

function buildCapsuleSnapshot(
  overrides: CapsuleSnapshotOverrides = {}
): CapsuleSnapshot {
  return {
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["spring"],
      audience: "woman",
      color: null,
      pattern: "solid",
      text: "",
      ...overrides.filters
    },
    data: {
      wardrobe: overrides.data?.wardrobe ?? null,
      rejectedUrls: overrides.data?.rejectedUrls ?? []
    }
  };
}

function normalizeFixtureCapsuleSnapshot(
  snapshot: CapsuleSnapshot | Record<string, unknown> | null | undefined
): CapsuleSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const filters = "filters" in snapshot && snapshot.filters && typeof snapshot.filters === "object" && !Array.isArray(snapshot.filters)
    ? snapshot.filters as Partial<CapsuleSnapshot["filters"]>
    : undefined;
  const data = "data" in snapshot && snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data)
    ? snapshot.data as CapsuleSnapshotOverrides["data"]
    : undefined;

  return buildCapsuleSnapshot({ filters, data });
}

function buildNormalizedCapsuleRecord(
  overrides: Omit<Partial<NormalizedCapsuleRecord>, "draft" | "saved"> & {
    draft?: CapsuleSnapshot | Record<string, unknown> | null;
    saved?: CapsuleSnapshot | Record<string, unknown> | null;
  } = {}
): NormalizedCapsuleRecord {
  const {
    draft,
    saved,
    status,
    ...rest
  } = overrides;

  return {
    id: "capsule-1",
    draft: draft === undefined ? buildCapsuleSnapshot() : normalizeFixtureCapsuleSnapshot(draft),
    saved: normalizeFixtureCapsuleSnapshot(saved),
    status: (status ?? "new") as NormalizedCapsuleRecord["status"],
    ...rest
  };
}

function buildWardrobeJobState(
  overrides: Partial<WardrobeJobState> = {}
): WardrobeJobState {
  return {
    capsuleRequestId: "req-1",
    status: "pending",
    startedAt: 1,
    updatedAt: 1,
    promise: null,
    phase: "capsule",
    result: null,
    ...overrides
  };
}

function buildPartialRegenerationJobState(
  overrides: Partial<PartialRegenerationJobState> = {}
): PartialRegenerationJobState {
  return {
    capsuleRequestId: "regen-req-1",
    status: "pending",
    phase: "regenerate",
    startedAt: 1,
    updatedAt: 1,
    pendingItemUrls: [],
    result: null,
    promise: null,
    ...overrides
  };
}

function buildUserProfileLike(
  overrides: Partial<UserProfileLike> = {}
): UserProfileLike {
  return {
    locale: "en",
    llm: "openai:gpt-5.2",
    ...overrides
  };
}

function buildProfileWithItems(
  overrides: Partial<ProfileWithItemsLike> = {}
): ProfileWithItemsLike {
  return {
    locale: "en",
    items: {
      items: []
    },
    ...overrides
  };
}

function buildProductRow(
  overrides: Partial<ProductRowLike> = {}
): ProductRowLike {
  return {
    id: "product-1",
    name: "Product 1",
    url: "https://example.com/product-1",
    description: "Description",
    brand: "Brand",
    price: 100,
    currency: "USD",
    availability: null,
    imageUrl: "https://example.com/product-1.jpg",
    audience: "woman",
    category: "top",
    season: null,
    formalityLevel: null,
    style: null,
    occasions: null,
    colorBase: null,
    pattern: null,
    finish: null,
    isNeutral: null,
    composition: null,
    silhouette: null,
    fit: null,
    closureType: null,
    ...overrides
  };
}

export {
  buildCapsuleSnapshot,
  buildGeneratedOutfitSet,
  buildNormalizedCapsuleRecord,
  buildNormalizedProfileRecord,
  buildPartialRegenerationJobState,
  buildProductRow,
  buildProfileWithItems,
  buildStoredOutfitSet,
  buildStoredWardrobePayload,
  buildUserProfileLike,
  buildWardrobeGenerationResult,
  buildWardrobeJobState,
  buildWardrobeUiItem
};
