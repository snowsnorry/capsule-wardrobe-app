export function getOutfitSetImageRequestContext(req) {
  return {
    email: String(req?.user?.email || "")
      .trim()
      .toLowerCase(),
    capsuleId: String(req?.params?.id || "").trim(),
    setIndex: Number.parseInt(String(req?.params?.setIndex || ""), 10),
  };
}

export function isValidOutfitSetImageRequest({ capsuleId, setIndex }) {
  return Boolean(capsuleId) && Number.isInteger(setIndex) && setIndex >= 0;
}
