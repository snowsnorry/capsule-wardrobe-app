import { Box } from "@mui/material";
import ClothingCard from "../../components/ClothingCard";
import {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import { buildOutfitGridSectionSx } from "./OutfitScreenStyles";

export function OutfitGrid({
  isMobile,
  isSelectionMode,
  mobileCardColumns,
  onItemMenuOpen,
  onPreviewItem,
  onToggleSelected,
  selectedKeys,
  t,
  visibleItems,
}: {
  isMobile: boolean;
  isSelectionMode: boolean;
  mobileCardColumns: MobileCardColumns;
  onItemMenuOpen: (
    anchor: HTMLElement,
    entry: OutfitItemSnapshot,
    options: ProductMenuOpenOptions,
  ) => void;
  onPreviewItem: (entry: OutfitItemSnapshot) => void;
  onToggleSelected: (key: string) => void;
  selectedKeys: string[];
  t: (key: string) => string;
  visibleItems: OutfitItemSnapshot[];
}) {
  return (
    <Box sx={buildOutfitGridSectionSx(mobileCardColumns)}>
      <Box sx={buildOutfitGridSx(mobileCardColumns)}>
        {visibleItems.map((entry) => (
          <ClothingCard
            key={entry.key}
            item={entry.item}
            isSelectable
            isSelected={selectedKeys.includes(entry.key)}
            isSelectionMode={isSelectionMode}
            onToggleSelected={() => onToggleSelected(entry.key)}
            onProductClick={() => onPreviewItem(entry)}
            allowProductMenuWithoutUrl
            isMobile={isMobile}
            mobileColumns={mobileCardColumns}
            selectionToggleIcon="check"
            selectionToggleLabel={t("outfit.selectItem")}
            onProductMenuOpen={(anchor, _productUrl, _item, options) =>
              onItemMenuOpen(anchor, entry, options)
            }
          />
        ))}
      </Box>
    </Box>
  );
}

function buildOutfitGridSx(mobileCardColumns: MobileCardColumns) {
  return {
    display: "grid",
    gridTemplateColumns: buildClothingGridTemplateColumns(mobileCardColumns),
    gap: buildClothingGridGap(mobileCardColumns),
    "@media (min-width: 1400px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
    "@media (min-width: 1760px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  } as const;
}
