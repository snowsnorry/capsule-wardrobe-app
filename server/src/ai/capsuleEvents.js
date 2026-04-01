import { createChannel, createSession } from "better-sse";
import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";

function createCapsuleEventKey(email, capsuleId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCapsuleId = String(capsuleId || "").trim();
  return normalizedCapsuleId ? `${normalizedEmail}::${normalizedCapsuleId}` : normalizedEmail;
}

function getStoredWardrobePayload(profile) {
  const stored = profile?.items;
  if (Array.isArray(stored)) {
    return {
      items: stored,
      reasoning: null,
      rawSelectionText: null,
      swimwearReasoning: null,
      swimwearRawSelectionText: null
    };
  }

  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }

  return {
    items: Array.isArray(stored.items) ? stored.items : [],
    reasoning: typeof stored.reasoning === "string" && stored.reasoning.trim().length > 0
      ? stored.reasoning.trim()
      : null,
    rawSelectionText: typeof stored.rawSelectionText === "string" && stored.rawSelectionText.trim().length > 0
      ? stored.rawSelectionText.trim()
      : null,
    swimwearReasoning: typeof stored.swimwearReasoning === "string" && stored.swimwearReasoning.trim().length > 0
      ? stored.swimwearReasoning.trim()
      : null,
    swimwearRawSelectionText: typeof stored.swimwearRawSelectionText === "string" && stored.swimwearRawSelectionText.trim().length > 0
      ? stored.swimwearRawSelectionText.trim()
      : null
  };
}

function buildSnapshotPayload({
  status = "idle",
  pendingStage = null,
  hasPendingAdditionalItems = false,
  pendingRegenerationUrls = [],
  items = [],
  reasoning = null,
  rawSelectionText = null,
  swimwearReasoning = null,
  swimwearRawSelectionText = null,
  error = null
} = {}) {
  return {
    status,
    pendingStage,
    hasPendingAdditionalItems,
    pendingRegenerationUrls,
    items,
    reasoning,
    rawSelectionText,
    swimwearReasoning,
    swimwearRawSelectionText,
    error
  };
}

function buildFailedSnapshot(storedWardrobe, error) {
  return buildSnapshotPayload({
    status: "failed",
    items: storedWardrobe?.items || [],
    reasoning: storedWardrobe?.reasoning || null,
    rawSelectionText:
      typeof error?.rawSelectionText === "string" && error.rawSelectionText.trim().length > 0
        ? error.rawSelectionText.trim()
        : storedWardrobe?.rawSelectionText || null,
    swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null,
    error: "service_unavailable"
  });
}

function buildCapsuleEventSnapshot({
  capsule = null,
  activeJob = null,
  partialRegenerationJob = null
} = {}) {
  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const storedWardrobe = getStoredWardrobePayload({ items: effectiveSnapshot?.data?.wardrobe });

  if (partialRegenerationJob?.status === "pending") {
    return buildSnapshotPayload({
      status: "pending",
      pendingStage: "regenerate",
      pendingRegenerationUrls: Array.isArray(partialRegenerationJob.pendingItemUrls)
        ? partialRegenerationJob.pendingItemUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
        : [],
      items: storedWardrobe?.items || [],
      reasoning: storedWardrobe?.reasoning || null,
      rawSelectionText: storedWardrobe?.rawSelectionText || null,
      swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
      swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null
    });
  }

  if (partialRegenerationJob?.status === "failed") {
    return buildFailedSnapshot(storedWardrobe, partialRegenerationJob.error);
  }

  if (activeJob?.status === "pending" && activeJob.phase === "extras" && storedWardrobe?.items?.length) {
    return buildSnapshotPayload({
      status: "pending",
      pendingStage: "extras",
      hasPendingAdditionalItems: true,
      items: storedWardrobe.items,
      reasoning: storedWardrobe.reasoning,
      rawSelectionText: storedWardrobe.rawSelectionText,
      swimwearReasoning: storedWardrobe.swimwearReasoning,
      swimwearRawSelectionText: storedWardrobe.swimwearRawSelectionText
    });
  }

  if (storedWardrobe?.items?.length) {
    return buildSnapshotPayload({
      status: "ready",
      items: storedWardrobe.items,
      reasoning: storedWardrobe.reasoning,
      rawSelectionText: storedWardrobe.rawSelectionText,
      swimwearReasoning: storedWardrobe.swimwearReasoning,
      swimwearRawSelectionText: storedWardrobe.swimwearRawSelectionText
    });
  }

  if (activeJob?.status === "pending") {
    return buildSnapshotPayload({
      status: "pending",
      pendingStage: activeJob.phase === "extras" ? "extras" : "capsule",
      hasPendingAdditionalItems: activeJob.phase === "extras",
      items: storedWardrobe?.items || [],
      reasoning: storedWardrobe?.reasoning || null,
      rawSelectionText: storedWardrobe?.rawSelectionText || null,
      swimwearReasoning: storedWardrobe?.swimwearReasoning || null,
      swimwearRawSelectionText: storedWardrobe?.swimwearRawSelectionText || null
    });
  }

  if (activeJob?.status === "failed") {
    return buildFailedSnapshot(storedWardrobe, activeJob.error);
  }

  return buildSnapshotPayload();
}

function createCapsuleEventHub() {
  const channels = new Map();

  function getOrCreateChannel(key) {
    if (!channels.has(key)) {
      channels.set(key, createChannel());
    }
    return channels.get(key);
  }

  function pruneChannel(key, channel) {
    if (channels.get(key) === channel && channel.sessionCount === 0) {
      channels.delete(key);
    }
  }

  async function subscribe(req, res, { email, capsuleId, snapshot }) {
    const key = createCapsuleEventKey(email, capsuleId);
    const channel = getOrCreateChannel(key);
    const session = await createSession(req, res, {
      retry: 2000,
      keepAlive: 10000,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });

    channel.register(session);
    session.once("disconnected", () => {
      setTimeout(() => {
        pruneChannel(key, channel);
      }, 0);
    });

    await session.push(snapshot, "snapshot");
    return session;
  }

  function publish(email, capsuleId, snapshot) {
    const key = createCapsuleEventKey(email, capsuleId);
    const channel = channels.get(key);
    if (!channel) {
      return false;
    }
    channel.broadcast(snapshot, "snapshot");
    pruneChannel(key, channel);
    return true;
  }

  function getSessionCount(email, capsuleId) {
    const channel = channels.get(createCapsuleEventKey(email, capsuleId));
    return channel?.sessionCount || 0;
  }

  return {
    getSessionCount,
    publish,
    subscribe
  };
}

const capsuleEventHub = createCapsuleEventHub();

export {
  buildCapsuleEventSnapshot,
  capsuleEventHub,
  createCapsuleEventHub,
  createCapsuleEventKey,
  getStoredWardrobePayload
};
