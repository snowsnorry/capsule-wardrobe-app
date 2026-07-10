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

export { buildOutfitEventSnapshot };
