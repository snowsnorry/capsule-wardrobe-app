import { fetchRecentCapsules } from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import type { CapsuleListResponse, CapsuleMeta } from "./appTypes";

export async function refreshCapsuleList(context: AppActionContext) {
  const result = (await fetchRecentCapsules()) as CapsuleListResponse;
  fromContext<(value: CapsuleMeta[]) => void>(
    context,
    "setCapsuleList",
  )(result.capsules || []);
}
