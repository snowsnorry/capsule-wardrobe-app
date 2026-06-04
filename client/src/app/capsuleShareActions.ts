import { importSharedCapsule, shareCapsule } from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import { refreshCapsuleList } from "./capsuleListActions";
import type { CapsuleMeta, CapsuleMutationResponse } from "./appTypes";

export async function shareCurrentCapsule(
  context: AppActionContext,
  capsuleId: string,
) {
  if (!capsuleId) return {};
  try {
    return (await shareCapsule(capsuleId)) as {
      url?: string;
      expiresAt?: string | Date;
      blockedReason?: "personal_uploaded_items";
    };
  } catch (error) {
    if ((error as Error)?.message === "capsule_contains_personal_items") {
      return { blockedReason: "personal_uploaded_items" as const };
    }
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
      infoKey: "",
      infoParams: null,
    });
    return {};
  }
}

export async function importSharedCapsuleToApp(
  context: AppActionContext,
  shareId: string,
) {
  if (!shareId) return null;
  fromContext<(value: boolean) => void>(context, "setIsShareLoading")(true);
  try {
    const result = (await importSharedCapsule(
      shareId,
    )) as CapsuleMutationResponse;
    const importedCapsule = result.capsule || null;
    if (result.capsule) {
      fromContext<(capsule?: CapsuleMeta | null) => void>(
        context,
        "applyCapsuleState",
      )(result.capsule);
    }
    await refreshCapsuleList(context);
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: "",
      infoKey: "capsule.shareImported",
      infoParams: null,
    });
    fromContext<() => void>(context, "clearShareRoute")();
    return importedCapsule;
  } catch (error) {
    fromContext<(value: unknown) => void>(
      context,
      "setStatus",
    )({
      loading: false,
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
      infoKey: "",
      infoParams: null,
    });
    fromContext<() => void>(context, "clearShareRoute")();
    return null;
  } finally {
    if (fromContext<{ current: boolean }>(context, "isMountedRef").current) {
      fromContext<(value: boolean) => void>(
        context,
        "setIsShareLoading",
      )(false);
    }
  }
}
