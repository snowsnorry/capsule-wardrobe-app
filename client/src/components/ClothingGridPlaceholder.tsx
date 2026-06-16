import { Box } from "@mui/material";
import type { ReactElement } from "react";

type ClothingPlaceholderCardProps = {
  placeholderKey: string;
  mobileColumns?: MobileCardColumns;
};

type ClothingGridPlaceholderProps = {
  count?: number;
  inline?: boolean;
  mobileColumns?: MobileCardColumns;
};

type MobileCardColumns = 1 | 2 | 3;

const CLOTHING_GRID_THREE_COLUMN_MIN_WIDTH = 760;
const CLOTHING_GRID_FOUR_COLUMN_MIN_WIDTH = 1160;

function buildClothingGridTemplateColumns(
  mobileColumns: MobileCardColumns = 2,
) {
  return {
    xs: `repeat(${mobileColumns}, minmax(0, 1fr))`,
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "repeat(2, minmax(0, 1fr))",
  } as const;
}

const clothingGridTemplateColumns = buildClothingGridTemplateColumns(2);

const clothingGridGap = {
  xs: 1.25,
  xs2: 0,
  sm: 2.5,
} as const;

function buildClothingGridGap(mobileColumns: MobileCardColumns = 2) {
  return {
    xs: mobileColumns === 1 ? clothingGridGap.xs : clothingGridGap.xs2,
    sm: clothingGridGap.sm,
  } as const;
}

function buildResponsiveClothingGridSx(mobileColumns: MobileCardColumns = 2) {
  return {
    display: "grid",
    gridTemplateColumns: buildClothingGridTemplateColumns(mobileColumns),
    gap: buildClothingGridGap(mobileColumns),
    [`@container (min-width: ${CLOTHING_GRID_THREE_COLUMN_MIN_WIDTH}px)`]: {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
    [`@container (min-width: ${CLOTHING_GRID_FOUR_COLUMN_MIN_WIDTH}px)`]: {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
    "@supports not (container-type: inline-size)": {
      "@media (min-width: 1400px)": {
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      },
      "@media (min-width: 1760px)": {
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      },
    },
  } as const;
}

function ClothingPlaceholderCard({
  placeholderKey,
  mobileColumns = 2,
}: ClothingPlaceholderCardProps): ReactElement {
  const isDenseMobileCard = mobileColumns !== 1;

  return (
    <Box
      key={placeholderKey}
      className={`wardrobe-placeholder-card-root${isDenseMobileCard ? " wardrobe-placeholder-card-root-dense" : ""}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: {
          xs: isDenseMobileCard ? 0 : "var(--cw-radius-card)",
          sm: "var(--cw-radius-card)",
        },
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        border: {
          xs: isDenseMobileCard
            ? "1px solid var(--cw-color-product-dense-border)"
            : "1px solid var(--cw-color-product-border)",
          sm: "1px solid var(--cw-color-product-border)",
        },
        boxShadow: {
          xs: isDenseMobileCard ? "none" : "var(--cw-shadow-wardrobe-card)",
          sm: "var(--cw-shadow-wardrobe-card)",
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3 / 4",
          background: "var(--cw-gradient-placeholder-image)",
          backgroundSize: "200% 100%",
          animation: "placeholderShimmer 1.3s linear infinite",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            width: 112,
            height: 32,
            borderRadius: "var(--cw-radius-pill)",
            bgcolor: "var(--cw-color-category-badge-bg)",
          }}
        />
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          flexGrow: 1,
          px: 2.5,
          pt: 2,
          pb: 2.25,
          minHeight: 64,
          backgroundColor: "background.paper",
          borderTop: "1px solid var(--cw-color-product-detail-divider)",
        }}
      >
        <Box
          sx={{
            width: "72%",
            height: 20,
            borderRadius: "var(--cw-radius-sm)",
            background: "var(--cw-gradient-placeholder-text)",
            backgroundSize: "200% 100%",
            animation: "placeholderShimmer 1.3s linear infinite",
          }}
        />
      </Box>
    </Box>
  );
}

function renderPlaceholderCards(
  count: number,
  mobileColumns: MobileCardColumns,
): ReactElement[] {
  return Array.from({ length: count }).map((_, index) => (
    <ClothingPlaceholderCard
      key={`placeholder-${index}`}
      placeholderKey={`placeholder-${index}`}
      mobileColumns={mobileColumns}
    />
  ));
}

function ClothingGridPlaceholder({
  count = 12,
  inline = false,
  mobileColumns = 2,
}: ClothingGridPlaceholderProps): ReactElement | ReactElement[] {
  if (inline) {
    return renderPlaceholderCards(count, mobileColumns);
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
      {renderPlaceholderCards(count, mobileColumns)}
    </Box>
  );
}

export { ClothingPlaceholderCard };
export {
  CLOTHING_GRID_FOUR_COLUMN_MIN_WIDTH,
  CLOTHING_GRID_THREE_COLUMN_MIN_WIDTH,
  buildClothingGridGap,
  buildResponsiveClothingGridSx,
  buildClothingGridTemplateColumns,
  clothingGridGap,
  clothingGridTemplateColumns,
};
export default ClothingGridPlaceholder;
