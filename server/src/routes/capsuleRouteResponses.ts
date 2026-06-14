type CapsuleRouteRequest = {
  user: { email: string };
};
type CapsuleRouteResponse = {
  json(payload: unknown): unknown;
  status(code: number): CapsuleRouteResponse;
};
type CapsuleResponseContext<Capsule, CapsuleResponse, LikedUrls> = {
  annotateLikedItems(
    response: CapsuleResponse,
    likedUrls: LikedUrls,
  ): CapsuleResponse;
  listLikedItemUrlsImpl(email: string): Promise<LikedUrls>;
  toCapsuleResponse(capsule: Capsule): CapsuleResponse;
};

async function buildAnnotatedCapsuleResponse<
  Capsule,
  CapsuleResponse,
  LikedUrls,
>(
  capsule: Capsule,
  req: CapsuleRouteRequest,
  context: CapsuleResponseContext<Capsule, CapsuleResponse, LikedUrls>,
) {
  const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);
  return context.annotateLikedItems(
    context.toCapsuleResponse(capsule),
    likedUrls,
  );
}

async function sendCapsuleMutationResponse<Capsule, CapsuleResponse, LikedUrls>(
  req: CapsuleRouteRequest,
  res: CapsuleRouteResponse,
  capsule: Capsule | null | undefined,
  context: CapsuleResponseContext<Capsule, CapsuleResponse, LikedUrls>,
) {
  if (!capsule) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({
    ok: true,
    capsule: await buildAnnotatedCapsuleResponse(capsule, req, context),
  });
}

export { buildAnnotatedCapsuleResponse, sendCapsuleMutationResponse };
