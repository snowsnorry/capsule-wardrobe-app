import { Box, Stack, Typography } from "@mui/material";
import ClothingCard from "../components/ClothingCard";
import ClothingGridPlaceholder, {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../components/ClothingGridPlaceholder";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeGridProps = {
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
        <Typography variant="h6">{t("wardrobe.emptyTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("wardrobe.emptyBody")}
        </Typography>
      </Stack>
    );
  }

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
      {items.map((item) => (
        <ClothingCard
          key={item.id || item.url}
          item={item}
          allowProductMenuWithoutUrl
          isMobile={isOverlay}
          mobileColumns={mobileColumns}
          onProductClick={onProductClick}
          onProductMenuOpen={onProductMenuOpen}
        />
      ))}
    </Box>
  );
}

const emptyStateSx = {
  maxWidth: 520,
  pt: { xs: 3, md: 4 },
} as const;

export default WardrobeGrid;
