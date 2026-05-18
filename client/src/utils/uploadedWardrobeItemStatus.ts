type UploadedWardrobeItemStatusFields = {
  processingStatus?: unknown;
  source?: unknown;
};

function getUploadedWardrobeItemStatusFields(
  item: unknown,
): UploadedWardrobeItemStatusFields {
  return item && typeof item === "object"
    ? (item as UploadedWardrobeItemStatusFields)
    : {};
}

function isUploadedWardrobeItemNeedsReview(item: unknown) {
  const fields = getUploadedWardrobeItemStatusFields(item);
  return (
    fields.source === "uploaded" && fields.processingStatus === "needs_review"
  );
}

export { isUploadedWardrobeItemNeedsReview };
