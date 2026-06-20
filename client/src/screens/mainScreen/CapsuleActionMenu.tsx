import { Menu } from "@mui/material";
import MobileContextMenuOverlay from "../../components/MobileContextMenuOverlay";
import { useI18n } from "../../i18n/useI18n";
import {
  getMobileActionMenuLabel,
  normalizeCapsuleActionMenuProps,
} from "./CapsuleActionMenuModel";
import { getCapsuleMenuPermissions } from "./CapsuleActionMenuPermissions";
import CapsuleActionMenuItems from "./CapsuleActionMenuSections";
import type { CapsuleActionMenuProps } from "./CapsuleActionMenuTypes";

function CapsuleActionMenu(props: CapsuleActionMenuProps) {
  const {
    anchorEl,
    open,
    onClose,
    capsule,
    disabled,
    showAnalyze,
    canAnalyze,
    onAnalyze,
    showRegenerateAll,
    onRegenerateAll,
    onDownloadPdf,
    onRename,
    onRevert,
    onSave,
    onSetPin,
    onDuplicate,
    onShare,
    showShare,
    allowUnknownShareContent,
    showCardLayout,
    mobileCardColumns,
    onMobileCardColumnsChange,
    onDelete,
    pinCopyPrefix,
    presentation,
    originRect,
    mobilePreview,
  } = normalizeCapsuleActionMenuProps(props);
  const { t } = useI18n();
  const permissions = getCapsuleMenuPermissions(
    capsule,
    allowUnknownShareContent,
  );
  const isMobileContextMenu = presentation === "mobile-context";
  const resolvedMobileLabel = getMobileActionMenuLabel({
    capsule,
    mobileLabel: props.mobileLabel,
    pinCopyPrefix,
    t,
  });
  const actions = (
    <CapsuleActionMenuItems
      canAnalyze={canAnalyze}
      capsule={capsule}
      disabled={disabled}
      mobileCardColumns={mobileCardColumns}
      onAnalyze={onAnalyze}
      onClose={onClose}
      onDelete={onDelete}
      onDownloadPdf={onDownloadPdf}
      onDuplicate={onDuplicate}
      onMobileCardColumnsChange={onMobileCardColumnsChange}
      onRegenerateAll={onRegenerateAll}
      onRename={onRename}
      onRevert={onRevert}
      onSave={onSave}
      onSetPin={onSetPin}
      onShare={onShare}
      permissions={permissions}
      pinCopyPrefix={pinCopyPrefix}
      showAnalyze={showAnalyze}
      showCardLayout={showCardLayout}
      showRegenerateAll={showRegenerateAll}
      showShare={showShare}
    />
  );

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open && !isMobileContextMenu}
        onClose={onClose}
      >
        {actions}
      </Menu>
      <MobileContextMenuOverlay
        actions={actions}
        label={resolvedMobileLabel}
        open={open && isMobileContextMenu}
        originRect={originRect}
        preview={mobilePreview}
        previewSurface="paper"
        onClose={onClose}
      />
    </>
  );
}

export default CapsuleActionMenu;
