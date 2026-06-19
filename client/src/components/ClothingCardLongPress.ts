import { useCallback } from "react";
import type {
  ClothingCardItem,
  MobileContextMenuOriginRect,
  ProductMenuOpenOptions,
} from "./ClothingCardTypes";
import { useMobileLongPressContextMenu } from "./MobileLongPressContextMenu";

type ProductMenuOpenHandler = (
  anchor: HTMLElement,
  productUrl: string,
  item: ClothingCardItem,
  options: ProductMenuOpenOptions,
) => void;

function useMobileLongPressMenu({
  enabled,
  item,
  onOpen,
  productMenuKey,
}: {
  enabled: boolean;
  item: ClothingCardItem;
  onOpen?: ProductMenuOpenHandler;
  productMenuKey: string;
}) {
  const openProductMenu = useCallback(
    (anchor: HTMLElement, originRect?: MobileContextMenuOriginRect) => {
      if (!productMenuKey || typeof onOpen !== "function") {
        return;
      }

      onOpen(anchor, productMenuKey, item, {
        presentation: "mobile-context",
        ...(originRect ? { originRect } : {}),
      });
    },
    [item, onOpen, productMenuKey],
  );

  return useMobileLongPressContextMenu({
    enabled: enabled && Boolean(productMenuKey) && typeof onOpen === "function",
    onOpen: openProductMenu,
  });
}

export { useMobileLongPressMenu };
