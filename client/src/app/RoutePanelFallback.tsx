import { Box, LinearProgress } from "@mui/material";

export default function RoutePanelFallback() {
  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        px: { xs: 3, md: 4 },
      }}
    >
      <LinearProgress aria-label="Loading section" sx={{ width: "100%" }} />
    </Box>
  );
}
