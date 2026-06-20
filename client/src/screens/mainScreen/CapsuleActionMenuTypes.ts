import type { ReactNode } from "react";
import type {
  MobileContextMenuOriginRect,
  MobileContextMenuPresentation,
} from "../../components/MobileContextMenuTypes";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MobileCardColumns,
} from "./MainScreenTypes";

export type CapsuleActionMenuProps = {
  anchorEl: CapsuleMenuAnchor;
  open: boolean;
  onClose: () => void;
  capsule?: CapsuleLike | null;
  disabled?: boolean;
  presentation?: MobileContextMenuPresentation;
  originRect?: MobileContextMenuOriginRect;
  mobilePreview?: ReactNode;
  mobileLabel?: string;
  showAnalyze?: boolean;
  canAnalyze?: boolean;
  onAnalyze?: () => void;
  showRegenerateAll?: boolean;
  onRegenerateAll?: () => void;
  onDownloadPdf: () => void;
  onRename: () => void;
  onRevert: () => void;
  onSave: () => void;
  onSetPin?: (pin: boolean) => void;
  onDuplicate: () => void;
  onShare: () => void;
  showShare?: boolean;
  allowUnknownShareContent?: boolean;
  showCardLayout?: boolean;
  mobileCardColumns?: MobileCardColumns;
  onMobileCardColumnsChange?: (value: MobileCardColumns) => void;
  onDelete: () => void;
  pinCopyPrefix?: "capsule" | "outfit";
};

export type NormalizedCapsuleActionMenuProps = CapsuleActionMenuProps & {
  allowUnknownShareContent: boolean;
  canAnalyze: boolean;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  onMobileCardColumnsChange: ((value: MobileCardColumns) => void) | undefined;
  pinCopyPrefix: "capsule" | "outfit";
  showAnalyze: boolean;
  showCardLayout: boolean;
  showRegenerateAll: boolean;
  showShare: boolean;
};
