import type { ReactElement, ReactNode } from "react";
import ClothingCard from "./ClothingCard";
import type {
  ClothingCardItem,
  MobileContextMenuOriginRect,
} from "./ClothingCardTypes";
import MobileContextMenuOverlay from "./MobileContextMenuOverlay";

type MobileProductCardContextMenuProps = {
  actions: ReactNode;
  item: ClothingCardItem | null;
  label: string;
  open: boolean;
  originRect?: MobileContextMenuOriginRect;
  onClose: () => void;
};

function MobileProductCardContextMenu({
  actions,
  item,
  label,
  open,
  originRect,
  onClose,
}: MobileProductCardContextMenuProps): ReactElement | null {
  if (!item) {
    return null;
  }

  return (
    <MobileContextMenuOverlay
      actions={actions}
      label={label}
      open={open}
      originRect={originRect}
      onClose={onClose}
      preview={
        <ClothingCard
          item={item}
          disableImageGestures
          isMobile
          mobileColumns={1}
          showProductMenu={false}
        />
      }
    />
  );
}

export default MobileProductCardContextMenu;
