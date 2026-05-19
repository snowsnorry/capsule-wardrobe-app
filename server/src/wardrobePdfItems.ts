function getFirstPresentValue(...values) {
  return (
    values.find(
      (value) => value !== undefined && value !== null && value !== "",
    ) ?? null
  );
}

function normalizeWardrobeItemForPdf(item) {
  const source = item || {};
  return {
    ...source,
    imageUrl: getFirstPresentValue(source.imageUrl, source.rawImageUrl),
    rawImageUrl: getFirstPresentValue(source.rawImageUrl),
    formalityLevel: getFirstPresentValue(source.formalityLevel),
    colorBase: getFirstPresentValue(source.colorBase),
    isNeutral: getFirstPresentValue(source.isNeutral),
    closureType: getFirstPresentValue(source.closureType),
  };
}

export { normalizeWardrobeItemForPdf };
