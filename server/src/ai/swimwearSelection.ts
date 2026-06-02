import type { SwimwearCandidate } from "./types.js";
import { dedupeStrings } from "./swimwearUtils.js";

function normalizeSelectedSwimwearIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeStrings(value.map((item) => String(item || "").trim()));
}

function normalizeSwimwearSelection(
  selectedIds: unknown,
  candidates: SwimwearCandidate[],
) {
  const candidateMap = new Map(
    candidates.map((item) => [String(item.id), item]),
  );
  const selected = normalizeSelectedSwimwearIds(selectedIds)
    .map((id) => candidateMap.get(id))
    .filter(Boolean);

  const swimsuit = selected.find((item) => item?.swimwear_type === "swimsuit");
  if (swimsuit) {
    return [swimsuit];
  }

  const top = selected.find((item) => item?.swimwear_type === "swimwear_top");
  const bottom = selected.find(
    (item) => item?.swimwear_type === "swimwear_bottom",
  );

  if (top && bottom) {
    return [top, bottom];
  }

  if (top) {
    const fallbackBottom = candidates.find(
      (item) =>
        item?.swimwear_type === "swimwear_bottom" &&
        String(item.id) !== String(top.id),
    );
    return fallbackBottom ? [top, fallbackBottom] : [];
  }

  if (bottom) {
    const fallbackTop = candidates.find(
      (item) =>
        item?.swimwear_type === "swimwear_top" &&
        String(item.id) !== String(bottom.id),
    );
    return fallbackTop ? [fallbackTop, bottom] : [];
  }

  return [];
}

function selectSwimwearWithoutLlm(candidates: SwimwearCandidate[]) {
  return normalizeSwimwearSelection(
    candidates.map((item) => String(item?.id || "").trim()).filter(Boolean),
    candidates,
  );
}

export { normalizeSwimwearSelection, selectSwimwearWithoutLlm };
