async function sendOutfitMutationResponse(req, res, outfit, context) {
  if (!outfit) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({
    ok: true,
    outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
  });
}

async function buildAnnotatedOutfitResponse(outfit, req, context) {
  const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);
  const response = await context.toOutfitResponse(
    outfit,
    buildOutfitHydrationContext(req, context),
  );
  return annotateOutfitResponseItems(response, likedUrls, context);
}

function annotateOutfitResponseItems(response, likedUrls, context) {
  return {
    ...response,
    draft: annotateOutfitSnapshotItems(response.draft, likedUrls, context),
    saved: annotateOutfitSnapshotItems(response.saved, likedUrls, context),
    effective: annotateOutfitSnapshotItems(
      response.effective,
      likedUrls,
      context,
    ),
  };
}

function annotateOutfitSnapshotItems(snapshot, likedUrls, context) {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    items: snapshot.items.map((entry) => ({
      ...entry,
      item: entry.item
        ? context.annotateLikedItems(entry.item, likedUrls)
        : entry.item,
    })),
  };
}

function buildOutfitHydrationContext(req, context) {
  return {
    email: req.user.email,
    getProductsByUrlsForEmailImpl: context.getProductsByUrlsForEmailImpl,
    listWardrobeItemsByUrlsImpl: context.listWardrobeItemsByUrlsImpl,
  };
}

export {
  buildAnnotatedOutfitResponse,
  buildOutfitHydrationContext,
  sendOutfitMutationResponse,
};
