import { fetchRecentOutfits, searchOutfits } from "../api/outfits";
import { fromContext, type AppActionContext } from "./actionContext";
import type {
  CapsulePagination,
  OutfitListResponse,
  OutfitMeta,
} from "./appTypes";

const OUTFIT_SIDEBAR_PAGE_SIZE = 10;

function mergeOutfitLists(
  currentOutfits: OutfitMeta[],
  nextOutfits: OutfitMeta[],
) {
  const merged = [...currentOutfits];
  const indexesById = new Map(
    merged
      .map((outfit, index) => [String(outfit.id || ""), index] as const)
      .filter(([id]) => Boolean(id)),
  );

  for (const outfit of nextOutfits) {
    const id = String(outfit.id || "");
    const existingIndex = id ? indexesById.get(id) : undefined;
    if (existingIndex === undefined) {
      merged.push(outfit);
    } else {
      merged[existingIndex] = outfit;
    }
  }

  return merged;
}

function applyOutfitListResponse(
  context: AppActionContext,
  response: OutfitListResponse,
  { append = false }: { append?: boolean } = {},
) {
  const nextOutfits = response.outfits || [];
  fromContext<(value: OutfitMeta[]) => void>(
    context,
    "setOutfitList",
  )(
    append
      ? mergeOutfitLists(
          fromContext<OutfitMeta[]>(context, "outfitList") || [],
          nextOutfits,
        )
      : nextOutfits,
  );

  if (response.pagination) {
    fromContext<(value: CapsulePagination) => void>(
      context,
      "setOutfitPagination",
    )(response.pagination);
  }
}

export async function refreshOutfitList(context: AppActionContext) {
  const result = (await fetchRecentOutfits({
    limit: OUTFIT_SIDEBAR_PAGE_SIZE,
    offset: 0,
  })) as OutfitListResponse;
  applyOutfitListResponse(context, result);
}

export async function loadMoreRecentOutfits(context: AppActionContext) {
  const pagination = fromContext<CapsulePagination>(
    context,
    "outfitPagination",
  );
  const offset =
    (pagination?.offset || 0) + (pagination?.limit || OUTFIT_SIDEBAR_PAGE_SIZE);
  const result = (await fetchRecentOutfits({
    limit: OUTFIT_SIDEBAR_PAGE_SIZE,
    offset,
  })) as OutfitListResponse;
  applyOutfitListResponse(context, result, { append: true });
}

export async function searchUserOutfits(query: string) {
  const result = (await searchOutfits(query)) as OutfitListResponse;
  return result.outfits || [];
}
