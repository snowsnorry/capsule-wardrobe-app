import {
  createOutfit,
  deleteOutfit,
  duplicateOutfit,
  fetchOutfit,
  renameOutfit,
  revertOutfit,
  saveOutfit,
  selectOutfit,
  updateOutfitItems,
} from "../api/outfits";
import { fromContext, type AppActionContext } from "./actionContext";
import { runOutfitOperation, setActiveOutfit } from "./outfitActionHelpers";
import { refreshOutfitList } from "./outfitListActions";
import type {
  OutfitItemSnapshot,
  OutfitMeta,
  OutfitMutationResponse,
} from "./appTypes";

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
  source?: { capsuleId?: string; setIndex?: number | string },
) {
  let createdOutfit: OutfitMeta | null = null;
  await runOutfitOperation(context, async () => {
    const result = (await createOutfit({
      name,
      items,
      ...(source?.capsuleId
        ? {
            sourceCapsuleId: source.capsuleId,
            sourceSetIndex: Number.parseInt(String(source.setIndex ?? ""), 10),
          }
        : {}),
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
