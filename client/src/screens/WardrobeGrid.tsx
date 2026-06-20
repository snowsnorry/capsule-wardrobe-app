import { Box, Stack, Typography } from "@mui/material";
import ClothingCard from "../components/ClothingCard";
import ClothingGridPlaceholder, {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../components/ClothingGridPlaceholder";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeGridProps = {
  highlightedKeys?: string[];
  isFilteredEmpty?: boolean;
  isLoading: boolean;
  isOverlay: boolean;
  items: MainScreenItem[];
  mobileColumns: 1 | 2 | 3;
  onProductClick: (item: MainScreenItem) => void;
  onProductMenuOpen: (
    anchor: HTMLElement,
    productUrl: string,
    item: MainScreenItem,
    options: ProductMenuOpenOptions,
  ) => void;
  t: (key: string) => string;
};

function WardrobeGrid({
  highlightedKeys = [],
  isFilteredEmpty = false,
  isLoading,
  isOverlay,
  items,
  mobileColumns,
  onProductClick,
  onProductMenuOpen,
  t,
}: WardrobeGridProps) {
  if (isLoading) {
    return <ClothingGridPlaceholder count={12} mobileColumns={mobileColumns} />;
  }

  if (items.length === 0) {
    return (
      <Stack spacing={0.75} sx={emptyStateSx}>
        <Typography variant="h6">
          {t(
            isFilteredEmpty
              ? "wardrobe.filteredEmptyTitle"
              : "wardrobe.emptyTitle",
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            isFilteredEmpty
              ? "wardrobe.filteredEmptyBody"
              : "wardrobe.emptyBody",
          )}
        </Typography>
      </Stack>
    );
  }

  const highlightedKeySet = new Set(highlightedKeys);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: buildClothingGridTemplateColumns(mobileColumns),
        gap: buildClothingGridGap(mobileColumns),
        "@media (min-width: 1400px)": {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        },
        "@media (min-width: 1760px)": {
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      {items.map((item, index) => {
        const itemKey = getWardrobeItemKey(item);
        const highlighted = highlightedKeySet.has(itemKey);
        return (
          <Box
            key={itemKey || `personal-item-${index}`}
            data-testid={
              highlighted ? "personal-items-report-item-highlighted" : undefined
            }
            sx={getReportHighlightSx(highlighted)}
          >
            <ClothingCard
              item={item}
              allowProductMenuWithoutUrl
              isMobile={isOverlay}
              mobileColumns={mobileColumns}
              onProductClick={onProductClick}
              onProductMenuOpen={onProductMenuOpen}
            />
          </Box>
        );
      })}
    </Box>
  );
}

function getWardrobeItemKey(item: MainScreenItem) {
  return String(item?.id || item?.wardrobeId || "").trim();
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

const emptyStateSx = {
  maxWidth: 520,
  pt: { xs: 3, md: 4 },
} as const;

export default WardrobeGrid;
