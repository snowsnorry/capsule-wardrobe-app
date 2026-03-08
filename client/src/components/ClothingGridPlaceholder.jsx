import { Box } from "@mui/material";

function ClothingGridPlaceholder({ count = 12 }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(3, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))"
        },
        gap: 2.5
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={`placeholder-${index}`}
          sx={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 0.3,
            overflow: "hidden",
            backgroundColor: "background.paper",
            position: "relative",
            boxShadow: "0 16px 40px rgba(17, 36, 34, 0.08)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: 0.3,
              padding: "1px",
              background:
                "linear-gradient(140deg, rgba(28,124,124,0.2), rgba(240,180,41,0.2))",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              pointerEvents: "none"
            }
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
                width: 62,
                height: 32,
                borderRadius: "999px",
                bgcolor: "rgba(28,124,124,0.1)"
              }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,12,12,0.2) 100%)"
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                height: 32,
                borderRadius: 1.5,
                bgcolor: "rgba(255,255,255,0.22)"
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default ClothingGridPlaceholder;
