import { createCapsuleEventHub } from "./capsuleEventHub.js";

function buildOutfitEventSnapshot({
  outfit = null,
  pendingImage = false,
} = {}) {
  return {
    status: pendingImage ? "pending" : "ready",
    pendingImage: Boolean(pendingImage),
    outfit,
  };
}

const outfitEventHub = createCapsuleEventHub();

export { buildOutfitEventSnapshot, outfitEventHub };
