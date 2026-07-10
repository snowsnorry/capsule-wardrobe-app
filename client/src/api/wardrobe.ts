import { API_BASE_URL } from "./config";
import { requestJson } from "./request";
import { parseTrackedJobResponse, type JobResponse } from "./jobs";
import type { JsonObject } from "./request";

type WardrobeResponse = JsonObject;
type WardrobeMutationInput = {
  capsuleId?: string;
};
type SelectedWardrobeMutationInput = WardrobeMutationInput & {
  itemUrls: string[];
};
type OutfitSetMutationInput = WardrobeMutationInput & {
  setIndex?: number | string;
};

async function regenerateCapsuleWardrobe({
  capsuleId,
}: WardrobeMutationInput): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(
      `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate`,
      {
        method: "POST",
        credentials: "include",
      },
    ),
  );
}

async function regenerateSelectedWardrobeItems({
  itemUrls,
  capsuleId,
}: SelectedWardrobeMutationInput): Promise<JobResponse> {
  return parseTrackedJobResponse(
    await requestJson(
      `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/regenerate-selected`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemUrls }),
      },
    ),
  );
}

async function generateOutfitSetImage({
  capsuleId,
  setIndex,
}: OutfitSetMutationInput): Promise<WardrobeResponse | JobResponse> {
  const response = await requestJson(
    `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/outfit-sets/${Number.parseInt(String(setIndex ?? ""), 10)}/image`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  return response?.job ? parseTrackedJobResponse(response) : response;
}

async function deleteOutfitSetImage({
  capsuleId,
  setIndex,
}: OutfitSetMutationInput): Promise<WardrobeResponse> {
  return requestJson(
    `${API_BASE_URL}/capsules/${String(capsuleId || "").trim()}/outfit-sets/${Number.parseInt(String(setIndex ?? ""), 10)}/image`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
}

export {
  deleteOutfitSetImage,
  generateOutfitSetImage,
  regenerateCapsuleWardrobe,
  regenerateSelectedWardrobeItems,
};
