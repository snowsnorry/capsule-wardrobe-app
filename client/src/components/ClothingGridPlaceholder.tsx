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
        borderRadius: { xs: isDenseMobileCard ? 0 : "8px", sm: "8px" },
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        border: {
          xs: isDenseMobileCard
            ? "1px solid rgba(17, 36, 34, 0.44)"
            : "1px solid rgba(17, 36, 34, 0.08)",
          sm: "1px solid rgba(17, 36, 34, 0.08)",
        },
        boxShadow: {
          xs: isDenseMobileCard ? "none" : "0 0px 8px rgba(17, 36, 34, 0.08)",
          sm: "0 0px 8px rgba(17, 36, 34, 0.08)",
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3 / 4",
          background:
            "linear-gradient(110deg, #ece8e2 8%, #f6f4f1 18%, #ece8e2 33%)",
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
            borderRadius: "999px",
            bgcolor: "#dcefeb",
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
          borderTop: "1px solid rgba(15, 23, 42, 0.055)",
        }}
      >
        <Box
          sx={{
            width: "72%",
            height: 20,
            borderRadius: "6px",
            background:
              "linear-gradient(110deg, #e5e7eb 8%, #f8fafc 18%, #e5e7eb 33%)",
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
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
  clothingGridGap,
  clothingGridTemplateColumns,
};
export default ClothingGridPlaceholder;
