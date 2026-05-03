import { Box } from "@mui/material";
import type { ReactElement } from "react";

type ClothingPlaceholderCardProps = {
  placeholderKey: string;
};

type ClothingGridPlaceholderProps = {
  count?: number;
  inline?: boolean;
};

function ClothingPlaceholderCard({ placeholderKey }: ClothingPlaceholderCardProps): ReactElement {
  return (
    <Box
      key={placeholderKey}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        border: "1px solid rgba(17, 36, 34, 0.08)",
        boxShadow: "0 0px 8px rgba(17, 36, 34, 0.08)"
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
          overflow: "hidden"
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
            bgcolor: "#dcefeb"
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
          backgroundColor: "#fff",
          borderTop: "1px solid rgba(15, 23, 42, 0.055)"
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
            animation: "placeholderShimmer 1.3s linear infinite"
          }}
        />
      </Box>
    </Box>
  );
}

function renderPlaceholderCards(count: number): ReactElement[] {
  return Array.from({ length: count }).map((_, index) => (
    <ClothingPlaceholderCard
      key={`placeholder-${index}`}
      placeholderKey={`placeholder-${index}`}
    />
  ));
}

function ClothingGridPlaceholder({
  count = 12,
  inline = false
}: ClothingGridPlaceholderProps): ReactElement | ReactElement[] {
  if (inline) {
    return renderPlaceholderCards(count);
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(2, minmax(0, 1fr))"
        },
        gap: 2.5,
        "@media (min-width: 1400px)": {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
        },
        "@media (min-width: 1760px)": {
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
        }
      }}
    >
      {renderPlaceholderCards(count)}
    </Box>
  );
}

export { ClothingPlaceholderCard };
export default ClothingGridPlaceholder;
