import { Box } from "@mui/material";
import ClothingCard from "../../components/ClothingCard";
import {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import OutfitMissingItemCard from "./OutfitMissingItemCard";
import { buildOutfitGridSectionSx } from "./OutfitScreenStyles";
import { getOutfitItem, getOutfitItemKey } from "./outfitItemMappers";

export function OutfitGrid({
  disabled = false,
  highlightedKeys = [],
  isAfterCompactReport = false,
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
  disabled?: boolean;
  highlightedKeys?: string[];
  isAfterCompactReport?: boolean;
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
  const highlightedKeySet = new Set(highlightedKeys);
  return (
    <Box sx={buildOutfitGridSectionSx(mobileCardColumns, isAfterCompactReport)}>
      <Box sx={buildOutfitGridSx(mobileCardColumns)}>
        {visibleItems.map((entry) => {
          const key = getOutfitItemKey(entry);
          const item = getOutfitItem(entry);
          const highlighted = highlightedKeySet.has(key);
          return (
            <Box
              key={key}
              data-testid={highlighted ? "outfit-item-highlighted" : undefined}
              sx={getReportHighlightSx(highlighted)}
            >
              {item ? (
                <ClothingCard
                  item={item}
                  isSelectable={!disabled}
                  isSelected={selectedKeys.includes(key)}
                  isSelectionMode={isSelectionMode}
                  onToggleSelected={() => {
                    if (!disabled) onToggleSelected(key);
                  }}
                  onProductClick={
                    disabled ? undefined : () => onPreviewItem(entry)
                  }
                  allowProductMenuWithoutUrl
                  showProductMenu={!disabled}
                  isMobile={isMobile}
                  mobileColumns={mobileCardColumns}
                  selectionToggleIcon="check"
                  selectionToggleLabel={t("outfit.selectItem")}
                  onProductMenuOpen={(anchor, _productUrl, _item, options) => {
                    if (!disabled) onItemMenuOpen(anchor, entry, options);
                  }}
                />
              ) : (
                <OutfitMissingItemCard
                  entry={entry}
                  isMobile={isMobile}
                  isSelected={selectedKeys.includes(key)}
                  isSelectionMode={isSelectionMode && !disabled}
                  mobileColumns={mobileCardColumns}
                  t={t}
                  onItemMenuOpen={(anchor, menuEntry, options) => {
                    if (!disabled) onItemMenuOpen(anchor, menuEntry, options);
                  }}
                  onToggleSelected={(selectedKey) => {
                    if (!disabled) onToggleSelected(selectedKey);
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function getReportHighlightSx(highlighted: boolean) {
  return {
    minWidth: 0,
    borderRadius: "var(--cw-radius-card)",
    outline: highlighted
      ? "2px solid var(--cw-color-primary)"
      : "2px solid transparent",
    outlineOffset: 3,
    transition: "outline-color 140ms ease, background-color 140ms ease",
  } as const;
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
