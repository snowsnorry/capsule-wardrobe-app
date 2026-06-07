import { fetchRecentCapsules } from "../api/capsules";
import { fromContext, type AppActionContext } from "./actionContext";
import type {
  CapsuleListResponse,
  CapsuleMeta,
  CapsulePagination,
} from "./appTypes";

const CAPSULE_SIDEBAR_PAGE_SIZE = 10;

function mergeCapsuleLists(
  currentCapsules: CapsuleMeta[],
  nextCapsules: CapsuleMeta[],
) {
  const merged = [...currentCapsules];
  const indexesById = new Map(
    merged
      .map((capsule, index) => [String(capsule.id || ""), index] as const)
      .filter(([id]) => Boolean(id)),
  );

  for (const capsule of nextCapsules) {
    const id = String(capsule.id || "");
    const existingIndex = id ? indexesById.get(id) : undefined;
    if (existingIndex === undefined) {
      merged.push(capsule);
    } else {
      merged[existingIndex] = capsule;
    }
  }

  return merged;
}

async function fetchCapsuleListPage({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}) {
  return (await fetchRecentCapsules({ limit, offset })) as CapsuleListResponse;
}

function applyCapsuleListResponse(
  context: AppActionContext,
  response: CapsuleListResponse,
  { append = false }: { append?: boolean } = {},
) {
  const nextCapsules = response.capsules || [];
  fromContext<(value: CapsuleMeta[]) => void>(
    context,
    "setCapsuleList",
  )(
    append
      ? mergeCapsuleLists(
          fromContext<CapsuleMeta[]>(context, "capsuleList") || [],
          nextCapsules,
        )
      : nextCapsules,
  );

  if (response.pagination) {
    fromContext<(value: CapsulePagination) => void>(
      context,
      "setCapsulePagination",
    )(response.pagination);
  }
}

export async function refreshCapsuleList(context: AppActionContext) {
  const result = await fetchCapsuleListPage({
    limit: CAPSULE_SIDEBAR_PAGE_SIZE,
    offset: 0,
  });
  applyCapsuleListResponse(context, result);
}

export async function loadMoreRecentCapsules(context: AppActionContext) {
  const pagination = fromContext<CapsulePagination>(
    context,
    "capsulePagination",
  );
  const offset =
    (pagination?.offset || 0) +
    (pagination?.limit || CAPSULE_SIDEBAR_PAGE_SIZE);
  const result = await fetchCapsuleListPage({
    limit: CAPSULE_SIDEBAR_PAGE_SIZE,
    offset,
  });
  applyCapsuleListResponse(context, result, { append: true });
}
