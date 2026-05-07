import {
  getCapsuleIdValue,
  type NormalizedCapsuleRecord,
} from "./capsuleStoreModel.js";

export async function deleteCapsuleForStore({
  email,
  capsuleId,
  deleteCapsuleByIdForEmailImpl,
  getProfileImpl,
  listRecentCapsulesImpl,
  setActiveCapsuleIdImpl,
  createBootstrapCapsuleImpl,
}: {
  email: string;
  capsuleId: string;
  deleteCapsuleByIdForEmailImpl;
  getProfileImpl;
  listRecentCapsulesImpl: (
    email: string,
    limit?: number,
  ) => Promise<NormalizedCapsuleRecord[]>;
  setActiveCapsuleIdImpl: (
    email: string,
    activeCapsuleId: string | null,
  ) => Promise<unknown>;
  createBootstrapCapsuleImpl: (
    email: string,
  ) => Promise<NormalizedCapsuleRecord | null>;
}): Promise<boolean> {
  const deleted = await deleteCapsuleByIdForEmailImpl({ email, capsuleId });
  if (!deleted) {
    return false;
  }

  const profile = await getProfileImpl(email);
  if (profile?.activeCapsuleId !== capsuleId) {
    return true;
  }

  const [recentCapsule] = await listRecentCapsulesImpl(email, 1);
  if (recentCapsule) {
    await setActiveCapsuleIdImpl(email, getCapsuleIdValue(recentCapsule));
  } else {
    const capsule = await createBootstrapCapsuleImpl(email);
    await setActiveCapsuleIdImpl(email, getCapsuleIdValue(capsule));
  }

  return true;
}
