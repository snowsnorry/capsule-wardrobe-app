import { capsuleCanRequestShare } from "./MainScreenHelpers";
import type { CapsuleLike } from "./MainScreenTypes";

export type CapsuleMenuPermissions = {
  canRevert: boolean;
  canSave: boolean;
  canDuplicate: boolean;
  canShare: boolean;
};

export function getCapsuleMenuPermissions(
  capsule: CapsuleLike | null | undefined,
  allowUnknownShareContent: boolean,
): CapsuleMenuPermissions {
  return {
    canRevert: capsule?.status === "modified",
    canSave: capsule?.status === "new" || capsule?.status === "modified",
    canDuplicate: Boolean(capsule?.saved),
    canShare: capsuleCanRequestShare(capsule, {
      allowUnknownContent: allowUnknownShareContent,
    }),
  };
}
