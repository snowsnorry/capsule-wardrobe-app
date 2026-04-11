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

const DEFAULT_CAPSULE_NAME = "<New capsule>";

function normalizeCapsulePattern(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "solid";
}

function normalizeWardrobePayload(payload = null) {
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
            : null
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

function normalizeCapsuleFilters(filters = null) {
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

function normalizeCapsuleSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return {
    filters: normalizeCapsuleFilters(snapshot.filters),
    data: {
      wardrobe: normalizeWardrobePayload(snapshot.data?.wardrobe),
      rejectedUrls: Array.isArray(snapshot.data?.rejectedUrls)
        ? [...new Set(snapshot.data.rejectedUrls.map((value) => String(value || "").trim()).filter(Boolean))]
        : []
    }
  };
}

function normalizeCapsuleRecord(capsule) {
  if (!capsule) {
    return null;
  }

  const draft = normalizeCapsuleSnapshot(capsule.draft);
  const saved = normalizeCapsuleSnapshot(capsule.saved);
  const hasSaved = Boolean(saved);
  const hasDraft = Boolean(draft);
  let status = "new";

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

function getEffectiveCapsuleSnapshot(capsule) {
  const normalized = normalizeCapsuleRecord(capsule);
  return normalized?.draft || normalized?.saved || null;
}

function buildSnapshotFromProfile(profile = null) {
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

function buildProfileCapsuleContext(profile = null, capsule = null) {
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

async function buildUniqueCapsuleName(email, preferredName = DEFAULT_CAPSULE_NAME) {
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

async function setActiveCapsuleId(email, activeCapsuleId) {
  return updateProfileActiveCapsuleIdByEmail({ email, activeCapsuleId });
}

async function getCapsule(email, capsuleId) {
  return normalizeCapsuleRecord(await getCapsuleByIdForEmail({ email, capsuleId }));
}

async function listRecentCapsules(email, limit = 10) {
  const rows = await listRecentCapsulesByEmail({ email, limit });
  return rows.map(normalizeCapsuleRecord);
}

async function searchCapsules(email, query, limit = 25) {
  const rows = await searchCapsulesByEmail({ email, query, limit });
  return rows.map(normalizeCapsuleRecord);
}

async function createCapsule(email, {
  name,
  draft = null,
  saved = null,
  setActive = true
} = {}) {
  const resolvedName = await buildUniqueCapsuleName(email, name || DEFAULT_CAPSULE_NAME);
  const capsule = normalizeCapsuleRecord(await createCapsuleRecord({
    email,
    name: resolvedName,
    draft: normalizeCapsuleSnapshot(draft),
    saved: normalizeCapsuleSnapshot(saved)
  }));
  if (capsule && setActive) {
    await setActiveCapsuleId(email, capsule.id);
  }
  return capsule;
}

async function createBootstrapCapsule(email) {
  const profile = await getProfile(email);
  return createCapsule(email, {
    draft: buildSnapshotFromProfile(profile),
    setActive: true
  });
}

async function resolveActiveCapsule(email) {
  const profile = await getProfile(email);
  if (profile?.activeCapsuleId) {
    const activeCapsule = await getCapsule(email, profile.activeCapsuleId);
    if (activeCapsule) {
      return activeCapsule;
    }
  }

  const [recentCapsule] = await listRecentCapsules(email, 1);
  if (recentCapsule) {
    await setActiveCapsuleId(email, recentCapsule.id);
    return recentCapsule;
  }

  return createBootstrapCapsule(email);
}

async function updateCapsuleSnapshot(email, capsuleId, draft) {
  return normalizeCapsuleRecord(await updateCapsuleSnapshotByIdForEmail({
    email,
    capsuleId,
    draft: normalizeCapsuleSnapshot(draft)
  }));
}

async function renameCapsule(email, capsuleId, name) {
  const resolvedName = await buildUniqueCapsuleName(email, name);
  return normalizeCapsuleRecord(await renameCapsuleByIdForEmail({ email, capsuleId, name: resolvedName }));
}

async function saveCapsule(email, capsuleId) {
  return normalizeCapsuleRecord(await saveCapsuleByIdForEmail({ email, capsuleId }));
}

async function revertCapsule(email, capsuleId) {
  return normalizeCapsuleRecord(await revertCapsuleDraftByIdForEmail({ email, capsuleId }));
}

async function duplicateCapsule(email, capsuleId, name = DEFAULT_CAPSULE_NAME) {
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

async function deleteCapsule(email, capsuleId) {
  const deleted = await deleteCapsuleByIdForEmail({ email, capsuleId });
  if (!deleted) {
    return false;
  }

  const profile = await getProfile(email);
  if (profile?.activeCapsuleId === capsuleId) {
    const [recentCapsule] = await listRecentCapsules(email, 1);
    if (recentCapsule) {
      await setActiveCapsuleId(email, recentCapsule.id);
    } else {
      const capsule = await createBootstrapCapsule(email);
      await setActiveCapsuleId(email, capsule.id);
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
