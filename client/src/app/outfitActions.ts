import {
  createOutfit,
  deleteOutfit,
  downloadOutfitPdf,
  duplicateOutfit,
  fetchOutfit,
  fetchRecentOutfits,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  searchOutfits,
  selectOutfit,
  updateOutfitItems,
} from "../api/outfits";
import { fromContext, type AppActionContext } from "./actionContext";
import type {
  CapsulePagination,
  OutfitItemSnapshot,
  OutfitListResponse,
  OutfitMeta,
  OutfitMutationResponse,
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

function setActiveOutfit(context: AppActionContext, outfit: OutfitMeta | null) {
  fromContext<(value: string) => void>(
    context,
    "setActiveOutfitId",
  )(String(outfit?.id || ""));
  fromContext<(value: OutfitMeta | null) => void>(
    context,
    "setActiveOutfitMeta",
  )(outfit);
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

async function runOutfitOperation(
  context: AppActionContext,
  operation: () => Promise<void>,
) {
  fromContext<(value: boolean) => void>(
    context,
    "setIsContentOperationLoading",
  )(true);
  try {
    await operation();
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsContentOperationLoading",
    )(false);
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

export async function createNewOutfit(context: AppActionContext) {
  let createdOutfit: OutfitMeta | null = null;
  await runOutfitOperation(context, async () => {
    const result = (await createOutfit()) as OutfitMutationResponse;
    createdOutfit = result.outfit || null;
    setActiveOutfit(context, createdOutfit);
  });
  void refreshOutfitList(context).catch(() => undefined);
  return createdOutfit;
}

export async function copyOutfitSetToOutfits(
  context: AppActionContext,
  name: string,
  items: Record<string, unknown>[],
) {
  let createdOutfit: OutfitMeta | null = null;
  await runOutfitOperation(context, async () => {
    const result = (await createOutfit({
      name,
      items,
    })) as OutfitMutationResponse;
    const outfit = result.outfit || null;
    const outfitId = String(outfit?.id || "");
    if (outfitId) {
      const savedResult = (await saveOutfit(
        outfitId,
      )) as OutfitMutationResponse;
      createdOutfit = savedResult.outfit || outfit;
    } else {
      createdOutfit = outfit;
    }
    await refreshOutfitList(context);
  });
  return createdOutfit;
}

export async function openOutfit(context: AppActionContext, outfitId: string) {
  await runOutfitOperation(context, async () => {
    const result = (await fetchOutfit(outfitId)) as OutfitMutationResponse;
    setActiveOutfit(context, result.outfit || null);
    await refreshOutfitList(context);
  });
}

async function mutateCurrentOutfit(
  context: AppActionContext,
  outfitId: string,
  mutation: () => Promise<OutfitMutationResponse>,
  applyResult: (result: OutfitMutationResponse) => void,
) {
  if (!outfitId) return;
  await runOutfitOperation(context, async () => {
    const result = await mutation();
    applyResult(result);
    await refreshOutfitList(context);
  });
}

export async function saveCurrentOutfit(
  context: AppActionContext,
  outfitId: string,
) {
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => saveOutfit(outfitId) as Promise<OutfitMutationResponse>,
    (result) => setActiveOutfit(context, result.outfit || null),
  );
}

export async function revertCurrentOutfit(
  context: AppActionContext,
  outfitId: string,
) {
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => revertOutfit(outfitId) as Promise<OutfitMutationResponse>,
    (result) => setActiveOutfit(context, result.outfit || null),
  );
}

export async function renameCurrentOutfit(
  context: AppActionContext,
  name: string,
  outfitId: string,
) {
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => renameOutfit(outfitId, name) as Promise<OutfitMutationResponse>,
    (result) => setActiveOutfit(context, result.outfit || null),
  );
}

export async function duplicateCurrentOutfit(
  context: AppActionContext,
  name: string,
  outfitId: string,
) {
  let duplicatedOutfit: OutfitMeta | null = null;
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => duplicateOutfit(outfitId, name) as Promise<OutfitMutationResponse>,
    (result) => {
      duplicatedOutfit = result.outfit || null;
      setActiveOutfit(context, duplicatedOutfit);
    },
  );
  return duplicatedOutfit;
}

export async function deleteCurrentOutfit(
  context: AppActionContext,
  outfitId: string,
) {
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => deleteOutfit(outfitId) as Promise<OutfitMutationResponse>,
    () => {
      if (outfitId === fromContext<string>(context, "activeOutfitId")) {
        setActiveOutfit(context, null);
      }
    },
  );
}

export async function replaceCurrentOutfitItems(
  context: AppActionContext,
  outfitId: string,
  items: OutfitItemSnapshot[],
) {
  await mutateCurrentOutfit(
    context,
    outfitId,
    () => updateOutfitItems(outfitId, items) as Promise<OutfitMutationResponse>,
    (result) => setActiveOutfit(context, result.outfit || null),
  );
}

export async function selectUserOutfit(outfitId: string) {
  await selectOutfit(outfitId);
}

export async function downloadCurrentOutfitPdf(
  context: AppActionContext,
  outfitId: string,
) {
  if (!outfitId) return;
  fromContext<(value: boolean) => void>(
    context,
    "setIsDownloadingWardrobePdf",
  )(true);
  try {
    await downloadOutfitPdf(outfitId);
  } finally {
    fromContext<(value: boolean) => void>(
      context,
      "setIsDownloadingWardrobePdf",
    )(false);
  }
}
