import type { SwimwearCandidate } from "./types.js";

const SWIMWEAR_TYPES = new Set(["swimsuit", "swimwear_top", "swimwear_bottom"]);

function normalizeSwimwearType(value: unknown) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  return SWIMWEAR_TYPES.has(normalized) ? normalized : null;
}

function inferSwimwearTypeFromName(item: SwimwearCandidate) {
  const name = String(item?.name || "").trim();
  if (/tankini|bikini top|swim(?:wear|ming)? top/i.test(name)) {
    return "swimwear_top";
  }

  if (
    /bikini bottoms?|bikini briefs|swim(?:wear|ming)? bottoms?|hipster|tanga|thong/i.test(
      name,
    )
  ) {
    return "swimwear_bottom";
  }

  if (/one[-\s]?piece|swimsuit|bathing suit|monokini|maillot/i.test(name)) {
    return "swimsuit";
  }

  return null;
}

function getSwimwearType(item: SwimwearCandidate) {
  const explicitType =
    normalizeSwimwearType((item as { swimwearType?: unknown })?.swimwearType) ||
    normalizeSwimwearType(item?.swimwear_type);
  if (explicitType) {
    return explicitType;
  }

  return String(item?.category || "")
    .trim()
    .toLowerCase() === "swimwear"
    ? inferSwimwearTypeFromName(item)
    : null;
}

function getSelectedSwimwearState(items: SwimwearCandidate[] = []) {
  const swimwearItems = items.filter(
    (item) =>
      String(item?.category || "")
        .trim()
        .toLowerCase() === "swimwear",
  );
  const swimsuit = swimwearItems.find(
    (item) => getSwimwearType(item) === "swimsuit",
  );
  const top = swimwearItems.find(
    (item) => getSwimwearType(item) === "swimwear_top",
  );
  const bottom = swimwearItems.find(
    (item) => getSwimwearType(item) === "swimwear_bottom",
  );
  const hasAmbiguousType = swimwearItems.some((item) => !getSwimwearType(item));
  const missingType =
    !swimsuit && top && !bottom
      ? "swimwear_bottom"
      : !swimsuit && bottom && !top
        ? "swimwear_top"
        : null;

  return {
    swimwearItems,
    hasAmbiguousType,
    isComplete: Boolean(!hasAmbiguousType && (swimsuit || (top && bottom))),
    missingType,
  };
}

function shouldCompleteSelectedSwimwear(items: SwimwearCandidate[] = []) {
  const swimwearState = getSelectedSwimwearState(items);
  return Boolean(swimwearState.missingType || swimwearState.hasAmbiguousType);
}

export {
  getSelectedSwimwearState,
  getSwimwearType,
  normalizeSwimwearType,
  shouldCompleteSelectedSwimwear,
};
