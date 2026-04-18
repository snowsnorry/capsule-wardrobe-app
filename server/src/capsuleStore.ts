import {
  createCapsuleRecord,
  deleteCapsuleByIdForEmail,
  getCapsuleByIdForEmail,
  listCapsuleNamesByEmail,
  listRecentCapsulesByEmail,
  renameCapsuleByIdForEmail,
  revertCapsuleDraftByIdForEmail,
  saveCapsuleByIdForEmail,
  searchCapsulesByEmail,
  updateCapsuleSnapshotByIdForEmail,
  updateProfileActiveCapsuleIdByEmail
} from "./db.js";
import { getProfile, normalizeOccasionList } from "./profileStore.js";

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
  reasoning: string | null;
  rawSelectionText: string | null;
  swimwearReasoning: string | null;
  swimwearRawSelectionText: string | null;
};

type CapsuleSnapshot = {
  filters: CapsuleFilters;
  data: {
    wardrobe: WardrobePayload | null;
    rejectedUrls: string[];
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

type CapsuleContextProfile = {
  locale?: string;
  [key: string]: unknown;
};

const DEFAULT_CAPSULE_NAME = "<New capsule>";

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
    reasoning: typeof payload.reasoning === "string" && payload.reasoning.trim() ? payload.reasoning.trim() : null,
    rawSelectionText: typeof payload.rawSelectionText === "string" && payload.rawSelectionText.trim()
      ? payload.rawSelectionText.trim()
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

function normalizeCapsuleSnapshot(snapshot: Record<string, unknown> | null = null): CapsuleSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const snapshotFilters = snapshot.filters && typeof snapshot.filters === "object" && !Array.isArray(snapshot.filters)
    ? (snapshot.filters as Record<string, unknown>)
    : null;
  const snapshotData = snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data)
    ? (snapshot.data as { wardrobe?: Record<string, unknown> | null; rejectedUrls?: unknown })
    : null;

  return {
    filters: normalizeCapsuleFilters(snapshotFilters),
    data: {
      wardrobe: normalizeWardrobePayload(snapshotData?.wardrobe ?? null),
      rejectedUrls: Array.isArray(snapshotData?.rejectedUrls)
        ? [...new Set(snapshotData.rejectedUrls.map((value) => String(value || "").trim()).filter(Boolean))]
        : []
    }
  };
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
      rejectedUrls: []
    }
  });
}

function buildProfileCapsuleContext(
  profile: CapsuleContextProfile | null = null,
  capsule: CapsuleRecord | null = null
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
    items: snapshot?.data?.wardrobe || null,
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
  buildSnapshotFromProfile,
  buildProfileCapsuleContext,
  createBootstrapCapsule,
  createCapsule,
  deleteCapsule,
  duplicateCapsule,
  getCapsule,
  getEffectiveCapsuleSnapshot,
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
