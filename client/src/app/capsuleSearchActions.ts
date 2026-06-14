import { searchCapsules } from "../api/capsules";
import type { CapsuleListResponse } from "./appTypes";

async function searchUserCapsules(query: string) {
  const result = (await searchCapsules(query)) as CapsuleListResponse;
  return result.capsules || [];
}

export { searchUserCapsules };
