import type {
  AppSidebarNavigationProps,
  CapsuleNavItem,
} from "./AppSidebarNavigationTypes";
import type { Translate } from "./AppSidebarNavigationRows";

export type PinCopyPrefix = "capsule" | "outfit";

export type SetCapsulePinHandler = (
  capsuleId: string,
  pin: boolean,
) => Promise<void> | void;

export type CapsuleRowProps = {
  capsule: CapsuleNavItem;
  activeCapsuleId: string;
  isInteractionDisabled: boolean;
  isOverlaySidebar: boolean;
  capsuleHasUnsavedChanges: (capsule: CapsuleNavItem) => boolean;
  onOpenCapsule?: (capsuleId: string) => void;
  onOpenCapsuleActions?: AppSidebarNavigationProps["onOpenCapsuleActions"];
  onSetCapsulePin?: SetCapsulePinHandler;
  pinCopyPrefix: PinCopyPrefix;
  t: Translate;
};
