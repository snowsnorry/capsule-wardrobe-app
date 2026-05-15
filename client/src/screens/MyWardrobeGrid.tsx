import type { MouseEvent } from "react";
import { Box, Stack, Typography } from "@mui/material";
import ClothingCard from "../components/ClothingCard";
import ClothingGridPlaceholder, {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../components/ClothingGridPlaceholder";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type MyWardrobeGridProps = {
  isLoading: boolean;
  isOverlay: boolean;
  items: MainScreenItem[];
  mobileColumns: 1 | 2 | 3;
  onProductClick: (item: MainScreenItem) => void;
  onProductMenuClick: (
    event: MouseEvent<HTMLButtonElement>,
    productUrl: string,
    item: MainScreenItem,
  ) => void;
  t: (key: string) => string;
};

function MyWardrobeGrid({
  isLoading,
  isOverlay,
  items,
  mobileColumns,
  onProductClick,
  onProductMenuClick,
  t,
}: MyWardrobeGridProps) {
  if (isLoading) {
    return <ClothingGridPlaceholder count={12} mobileColumns={mobileColumns} />;
  }

  if (items.length === 0) {
    return (
      <Stack spacing={0.75} sx={emptyStateSx}>
        <Typography variant="h6">{t("myWardrobe.emptyTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("myWardrobe.emptyBody")}
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
          onProductMenuClick={onProductMenuClick}
        />
      ))}
    </Box>
  );
}

const emptyStateSx = {
  maxWidth: 520,
  pt: { xs: 3, md: 4 },
} as const;

export default MyWardrobeGrid;
