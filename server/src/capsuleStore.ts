import {
  createCapsuleRecord,
  deleteCapsuleByIdForEmail,
  getCapsuleByIdForEmail,
  getValidSharedCapsuleById,
  hashCapsuleContent,
  listCapsuleNamesByEmail,
  listRecentCapsulesByEmail,
  pruneExpiredSharedCapsules,
  renameCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  saveCapsuleByIdForEmail,
  searchCapsulesByEmail,
  updateCapsuleSnapshotByIdForEmail,
  updateProfileActiveCapsuleIdByEmail,
  upsertSharedCapsule
} from "./db.js";
import { getProfile, normalizeOccasionList } from "./profileStore.js";
import { t, translateOption } from "../../shared/i18n/helpers.js";

type CapsuleFilters = {
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
};

type OutfitSetPayload = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

type WardrobePayload = {
  items: unknown[];
  outfitSets: OutfitSetPayload[];
  rawSelectionText: string | null;
  swimwearReasoning: string | null;
  swimwearRawSelectionText: string | null;
};

type CapsuleRegenerationMarker = {
  status: "pending";
  kind: "full";
  startedAt: string;
  requestId: string;
};

type CapsuleSnapshot = {
  filters: CapsuleFilters;
  data: {
    wardrobe: WardrobePayload | null;
    rejectedUrls: string[];
    regeneration: CapsuleRegenerationMarker | null;
  };
};

type CapsuleRecord = {
  id?: string | null;
  draft?: Record<string, unknown> | null;
  saved?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type NormalizedCapsuleRecord = Omit<CapsuleRecord, "draft" | "saved"> & {
  id?: string | null;
  draft: CapsuleSnapshot | null;
  saved: CapsuleSnapshot | null;
  status: "new" | "saved" | "modified";
};

type SharedCapsuleResult = {
  id: string;
  url: string;
  expiresAt: string | Date;
};

type SharedCapsuleMetadata = {
  id: string;
  name: string;
  expiresAt: string | Date;
};

type SharedCapsuleOgMetadata = {
  title: string;
  description: string;
  image: string;
};

type CapsuleContextProfile = {
  locale?: string;
  [key: string]: unknown;
};

type BuildProfileCapsuleContextOptions = {
  forceEmptyWardrobe?: boolean;
};

const DEFAULT_CAPSULE_NAME = "<New capsule>";
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeCapsulePattern(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "solid";
}

function normalizeWardrobePayload(payload: Record<string, unknown> | null = null): WardrobePayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    items,
    outfitSets: Array.isArray(payload.outfitSets)
      ? payload.outfitSets
        .map((set) => ({
          itemIds: Array.isArray(set?.itemIds)
            ? set.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
            : [],
          image: typeof set?.image === "string" && set.image.trim().length > 0
            ? set.image.trim()
            : null,
          imageObsolete: Boolean(set?.imageObsolete)
        }))
        .filter((set) => set.itemIds.length > 0)
      : [],
    rawSelectionText: typeof payload.rawSelectionText === "string" && payload.rawSelectionText.trim()
      ? payload.rawSelectionText.trim()
      : typeof payload.reasoning === "string" && payload.reasoning.trim()
        ? payload.reasoning.trim()
        : null,
    swimwearReasoning: typeof payload.swimwearReasoning === "string" && payload.swimwearReasoning.trim()
      ? payload.swimwearReasoning.trim()
      : null,
    swimwearRawSelectionText: typeof payload.swimwearRawSelectionText === "string" && payload.swimwearRawSelectionText.trim()
      ? payload.swimwearRawSelectionText.trim()
      : null
  };
}

function normalizeCapsuleFilters(filters: Record<string, unknown> | null = null): CapsuleFilters {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: ""
    };
  }

  return {
    formalityLevel: typeof filters.formalityLevel === "string" ? filters.formalityLevel : "",
    style: typeof filters.style === "string" ? filters.style : null,
    occasions: normalizeOccasionList(filters.occasions),
    season: Array.isArray(filters.season) ? filters.season.filter(Boolean) : [],
    audience: typeof filters.audience === "string" ? filters.audience : "",
    color: typeof filters.color === "string" ? filters.color : null,
    pattern: normalizeCapsulePattern(filters.pattern),
    text: typeof filters.text === "string" && filters.text.trim() ? filters.text.trim() : ""
  };
}

function normalizeCapsuleRegenerationMarker(value: unknown): CapsuleRegenerationMarker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const marker = value as Record<string, unknown>;
  const status = typeof marker.status === "string" ? marker.status.trim() : "";
  const kind = typeof marker.kind === "string" ? marker.kind.trim() : "";
  const startedAt = typeof marker.startedAt === "string" && marker.startedAt.trim().length > 0
    ? marker.startedAt.trim()
    : "";
  const requestId = typeof marker.requestId === "string" && marker.requestId.trim().length > 0
    ? marker.requestId.trim()
    : "";

  if (status !== "pending" || kind !== "full" || !startedAt || !requestId) {
    return null;
  }

  return {
    status: "pending",
    kind: "full",
    startedAt,
    requestId
  };
}

function normalizeCapsuleSnapshot(snapshot: Record<string, unknown> | null = null): CapsuleSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const snapshotFilters = snapshot.filters && typeof snapshot.filters === "object" && !Array.isArray(snapshot.filters)
    ? (snapshot.filters as Record<string, unknown>)
    : null;
  const snapshotData = snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data)
    ? (snapshot.data as { wardrobe?: Record<string, unknown> | null; rejectedUrls?: unknown; regeneration?: unknown })
    : null;

  return {
    filters: normalizeCapsuleFilters(snapshotFilters),
    data: {
      wardrobe: normalizeWardrobePayload(snapshotData?.wardrobe ?? null),
      rejectedUrls: Array.isArray(snapshotData?.rejectedUrls)
        ? [...new Set(snapshotData.rejectedUrls.map((value) => String(value || "").trim()).filter(Boolean))]
        : [],
      regeneration: normalizeCapsuleRegenerationMarker(snapshotData?.regeneration)
    }
  };
}

function buildCapsuleSnapshotWithRegeneration(
  snapshot: CapsuleSnapshot | null,
  regeneration: CapsuleRegenerationMarker | null
): CapsuleSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return normalizeCapsuleSnapshot({
    filters: snapshot.filters,
    data: {
      wardrobe: snapshot.data?.wardrobe || null,
      rejectedUrls: snapshot.data?.rejectedUrls || [],
      regeneration
    }
  });
}

function getCapsuleIdValue(capsule: { id?: unknown } | null): string | null {
  return typeof capsule?.id === "string" && capsule.id.trim() ? capsule.id : null;
}

function normalizeCapsuleRecord(capsule: CapsuleRecord | null): NormalizedCapsuleRecord | null {
  if (!capsule) {
    return null;
  }

  const draft = normalizeCapsuleSnapshot(capsule.draft);
  const saved = normalizeCapsuleSnapshot(capsule.saved);
  const hasSaved = Boolean(saved);
  const hasDraft = Boolean(draft);
  let status: NormalizedCapsuleRecord["status"] = "new";

  if (hasSaved && !hasDraft) {
    status = "saved";
  } else if (hasSaved && hasDraft) {
    status = JSON.stringify(saved) === JSON.stringify(draft) ? "saved" : "modified";
  }

  return {
    ...capsule,
    draft,
    saved,
    status
  };
}

function getEffectiveCapsuleSnapshot(capsule: CapsuleRecord | null): CapsuleSnapshot | null {
  const normalized = normalizeCapsuleRecord(capsule);
  return normalized?.draft || normalized?.saved || null;
}

function capsuleSnapshotHasWardrobe(snapshot: CapsuleSnapshot | null): boolean {
  const items = snapshot?.data?.wardrobe?.items;
  return Array.isArray(items) && items.length > 0;
}

function isShareableCapsuleSnapshot(snapshot: CapsuleSnapshot | null): boolean {
  return Boolean(snapshot && capsuleSnapshotHasWardrobe(snapshot) && !getCapsuleSnapshotRegeneration(snapshot));
}

function getCapsuleSnapshotRegeneration(snapshot: CapsuleSnapshot | null): CapsuleRegenerationMarker | null {
  return normalizeCapsuleRegenerationMarker(snapshot?.data?.regeneration);
}

function firstStringValue(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function translateCapsuleFilterValue(group: string, value: unknown): string {
  const normalizedValue = firstStringValue(value);
  return normalizedValue ? translateOption(group, normalizedValue, "en") : "";
}

function buildCapsuleFilterSentence(labelKey: string, value: string | string[]): string {
  const values = Array.isArray(value) ? value : [value];
  const translatedValues = values.map((item) => String(item || "").trim()).filter(Boolean);
  if (!translatedValues.length) {
    return "";
  }

  return `${t(labelKey, undefined, "en")}: ${translatedValues.join(", ")}`;
}

function buildSharedCapsuleDescription(filters: CapsuleFilters | null): string {
  if (!filters) {
    return "";
  }

  const sentences = [
    buildCapsuleFilterSentence("search.fields.formalityLevel", translateCapsuleFilterValue("styles", filters.formalityLevel)),
    buildCapsuleFilterSentence("search.fields.style", translateCapsuleFilterValue("styles", filters.style)),
    buildCapsuleFilterSentence(
      "search.fields.occasions",
      filters.occasions.map((value) => translateCapsuleFilterValue("occasions", value))
    ),
    buildCapsuleFilterSentence(
      "search.fields.season",
      filters.season.map((value) => translateCapsuleFilterValue("seasons", value))
    ),
    buildCapsuleFilterSentence("search.fields.audience", translateCapsuleFilterValue("audience", filters.audience)),
    buildCapsuleFilterSentence("search.fields.color", translateCapsuleFilterValue("accentColors", filters.color)),
    buildCapsuleFilterSentence("search.fields.pattern", translateCapsuleFilterValue("patterns", filters.pattern))
  ].filter(Boolean);

  return sentences.length ? `${sentences.join(". ")}.` : "";
}

function getSharedCapsuleImage(snapshot: CapsuleSnapshot | null): string {
  const wardrobe = snapshot?.data?.wardrobe;
  const outfitSets = Array.isArray(wardrobe?.outfitSets) ? wardrobe.outfitSets : [];
  for (const outfitSet of outfitSets) {
    const image = firstStringValue(outfitSet?.image);
    if (image) {
      return image;
    }
  }

  const items = Array.isArray(wardrobe?.items) ? wardrobe.items : [];
  const firstItem = items[0];
  return firstItem && typeof firstItem === "object" && !Array.isArray(firstItem)
    ? firstStringValue((firstItem as Record<string, unknown>).image_url)
    : "";
}

function buildSharedCapsuleOgMetadata({
  name,
  content
}: {
  name: unknown;
  content: unknown;
}): SharedCapsuleOgMetadata | null {
  const snapshot = normalizeCapsuleSnapshot(
    content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : null
  );
  if (!snapshot) {
    return null;
  }

  return {
    title: firstStringValue(name) || DEFAULT_CAPSULE_NAME,
    description: buildSharedCapsuleDescription(snapshot.filters),
    image: getSharedCapsuleImage(snapshot)
  };
}

function buildSnapshotFromProfile(profile: CapsuleContextProfile | null = null): CapsuleSnapshot | null {
  return normalizeCapsuleSnapshot({
    filters: {
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: ""
    },
    data: {
      wardrobe: null,
      rejectedUrls: [],
      regeneration: null
    }
  });
}

function buildProfileCapsuleContext(
  profile: CapsuleContextProfile | null = null,
  capsule: CapsuleRecord | null = null,
  options: BuildProfileCapsuleContextOptions = {}
): Record<string, unknown> {
  const snapshot = getEffectiveCapsuleSnapshot(capsule);
  const filters = snapshot?.filters || buildSnapshotFromProfile(profile)?.filters;
  return {
    ...profile,
    formalityLevel: filters?.formalityLevel || "",
    style: filters?.style ?? null,
    occasions: filters?.occasions || [],
    season: filters?.season || [],
    audience: filters?.audience || "",
    color: filters?.color ?? null,
    pattern: normalizeCapsulePattern(filters?.pattern),
    text: typeof filters?.text === "string" ? filters.text : "",
    locale: profile?.locale || "en",
    items: options.forceEmptyWardrobe ? null : snapshot?.data?.wardrobe || null,
    rejected: snapshot?.data?.rejectedUrls || []
  };
}

async function buildUniqueCapsuleName(email: string, preferredName: string = DEFAULT_CAPSULE_NAME): Promise<string> {
  const baseName = String(preferredName || DEFAULT_CAPSULE_NAME).trim() || DEFAULT_CAPSULE_NAME;
  const existingNames = await listCapsuleNamesByEmail(email);
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let index = 1;
  while (existingNames.includes(`${baseName} (${index})`)) {
    index += 1;
  }
  return `${baseName} (${index})`;
}

async function setActiveCapsuleId(email: string, activeCapsuleId: string | null) {
  return updateProfileActiveCapsuleIdByEmail({ email, activeCapsuleId });
}

async function getCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(await getCapsuleByIdForEmail({ email, capsuleId }));
}

async function listRecentCapsules(email: string, limit: number = 10): Promise<NormalizedCapsuleRecord[]> {
  const rows = await listRecentCapsulesByEmail({ email, limit });
  return rows.map(normalizeCapsuleRecord);
}

async function searchCapsules(email: string, query: string, limit: number = 25): Promise<NormalizedCapsuleRecord[]> {
  const rows = await searchCapsulesByEmail({ email, query, limit });
  return rows.map(normalizeCapsuleRecord);
}

async function createCapsule(email: string, {
  name,
  draft = null,
  saved = null,
  setActive = true
}: {
  name?: string;
  draft?: Record<string, unknown> | null;
  saved?: Record<string, unknown> | null;
  setActive?: boolean;
} = {}): Promise<NormalizedCapsuleRecord | null> {
  const resolvedName = await buildUniqueCapsuleName(email, name || DEFAULT_CAPSULE_NAME);
  const capsule = normalizeCapsuleRecord(await createCapsuleRecord({
    email,
    name: resolvedName,
    draft: normalizeCapsuleSnapshot(draft),
    saved: normalizeCapsuleSnapshot(saved)
  }));
  if (capsule && setActive) {
    await setActiveCapsuleId(email, getCapsuleIdValue(capsule));
  }
  return capsule;
}

async function createBootstrapCapsule(email: string): Promise<NormalizedCapsuleRecord | null> {
  const profile = await getProfile(email);
  return createCapsule(email, {
    draft: buildSnapshotFromProfile(profile),
    setActive: true
  });
}

async function resolveActiveCapsule(email: string): Promise<NormalizedCapsuleRecord | null> {
  const profile = await getProfile(email);
  if (profile?.activeCapsuleId) {
    const activeCapsule = await getCapsule(email, profile.activeCapsuleId);
    if (activeCapsule) {
      return activeCapsule;
    }
  }

  const [recentCapsule] = await listRecentCapsules(email, 1);
  if (recentCapsule) {
    await setActiveCapsuleId(email, getCapsuleIdValue(recentCapsule));
    return recentCapsule;
  }

  return createBootstrapCapsule(email);
}

async function updateCapsuleSnapshot(
  email: string,
  capsuleId: string,
  draft: Record<string, unknown> | null
): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(await updateCapsuleSnapshotByIdForEmail({
    email,
    capsuleId,
    draft: normalizeCapsuleSnapshot(draft)
  }));
}

async function renameCapsule(email: string, capsuleId: string, name: string): Promise<NormalizedCapsuleRecord | null> {
  const resolvedName = await buildUniqueCapsuleName(email, name);
  return normalizeCapsuleRecord(await renameCapsuleByIdForEmail({ email, capsuleId, name: resolvedName }));
}

async function saveCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(await saveCapsuleByIdForEmail({ email, capsuleId }));
}

async function revertCapsule(email: string, capsuleId: string): Promise<NormalizedCapsuleRecord | null> {
  return normalizeCapsuleRecord(await revertCapsuleDraftByIdForEmail({ email, capsuleId }));
}

async function duplicateCapsule(
  email: string,
  capsuleId: string,
  name: string = DEFAULT_CAPSULE_NAME
): Promise<NormalizedCapsuleRecord | null> {
  const capsule = await getCapsule(email, capsuleId);
  if (!capsule) {
    return null;
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  return createCapsule(email, {
    name,
    draft: null,
    saved: effectiveSnapshot
  });
}

function buildShareUrl(clientOrigin: string, shareId: string): string {
  const origin = String(clientOrigin || "").replace(/\/+$/, "") || "http://localhost:5173";
  return `${origin}/share/${encodeURIComponent(shareId)}`;
}

async function createCapsuleShare(
  email: string,
  capsuleId: string,
  clientOrigin: string
): Promise<SharedCapsuleResult | null> {
  const capsule = await getCapsule(email, capsuleId);
  if (!capsule) {
    return null;
  }

  const snapshot = capsule.draft || capsule.saved || null;
  if (!isShareableCapsuleSnapshot(snapshot)) {
    const error = new Error("capsule_not_shareable");
    (error as Error & { code?: string }).code = "capsule_not_shareable";
    throw error;
  }

  await pruneExpiredSharedCapsules();
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  const shared = await upsertSharedCapsule({
    profileEmail: email,
    name: String(capsule.name || DEFAULT_CAPSULE_NAME),
    content: snapshot as unknown as Record<string, unknown>,
    contentHash: hashCapsuleContent(snapshot),
    expiresAt
  });

  if (!shared) {
    return null;
  }

  return {
    id: shared.id,
    url: buildShareUrl(clientOrigin, shared.id),
    expiresAt: shared.expiresAt
  };
}

async function getSharedCapsule(id: string): Promise<SharedCapsuleMetadata | null> {
  const shared = await getValidSharedCapsuleById(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsules();
    return null;
  }

  return {
    id: shared.id,
    name: shared.name,
    expiresAt: shared.expiresAt
  };
}

async function getSharedCapsuleOgMetadata(id: string): Promise<SharedCapsuleOgMetadata | null> {
  const shared = await getValidSharedCapsuleById(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsules();
    return null;
  }

  return buildSharedCapsuleOgMetadata({
    name: shared.name,
    content: shared.content
  });
}

async function importSharedCapsule(email: string, id: string): Promise<NormalizedCapsuleRecord | null> {
  const shared = await getValidSharedCapsuleById(String(id || "").trim());
  if (!shared) {
    await pruneExpiredSharedCapsules();
    return null;
  }

  const content = normalizeCapsuleSnapshot(shared.content);
  if (!isShareableCapsuleSnapshot(content)) {
    const error = new Error("capsule_not_shareable");
    (error as Error & { code?: string }).code = "capsule_not_shareable";
    throw error;
  }

  return createCapsule(email, {
    name: shared.name,
    draft: null,
    saved: content,
    setActive: true
  });
}

async function deleteCapsule(email: string, capsuleId: string): Promise<boolean> {
  const deleted = await deleteCapsuleByIdForEmail({ email, capsuleId });
  if (!deleted) {
    return false;
  }

  const profile = await getProfile(email);
  if (profile?.activeCapsuleId === capsuleId) {
    const [recentCapsule] = await listRecentCapsules(email, 1);
    if (recentCapsule) {
      await setActiveCapsuleId(email, getCapsuleIdValue(recentCapsule));
    } else {
      const capsule = await createBootstrapCapsule(email);
      await setActiveCapsuleId(email, getCapsuleIdValue(capsule));
    }
  }

  return true;
}

export {
  DEFAULT_CAPSULE_NAME,
  buildCapsuleSnapshotWithRegeneration,
  buildSharedCapsuleOgMetadata,
  buildSnapshotFromProfile,
  buildProfileCapsuleContext,
  createBootstrapCapsule,
  createCapsule,
  createCapsuleShare,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
  getCapsuleSnapshotRegeneration,
  getSharedCapsule,
  getSharedCapsuleOgMetadata,
  importSharedCapsule,
  isShareableCapsuleSnapshot,
  listRecentCapsules,
  normalizeCapsuleFilters,
  normalizeCapsuleRecord,
  normalizeCapsuleSnapshot,
  resolveActiveCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  setActiveCapsuleId,
  updateCapsuleSnapshot,
  renameCapsule
};
