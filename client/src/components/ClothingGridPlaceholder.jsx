import { Box } from "@mui/material";

function ClothingGridPlaceholder({ count = 12 }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))"
        },
        gap: 2
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={`placeholder-${index}`}
          sx={{
            width: "100%",
            aspectRatio: "3 / 4",
            borderRadius: 0.3,
            background: "linear-gradient(110deg, #e6e6e6 8%, #f0f0f0 18%, #e6e6e6 33%)",
            backgroundSize: "200% 100%",
            animation: "placeholderShimmer 1.3s linear infinite"
          }}
        />
      ))}
    </Box>
  );
}

export default ClothingGridPlaceholder;
