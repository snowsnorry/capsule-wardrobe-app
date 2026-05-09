import { Stack, Typography } from "@mui/material";

function ClothingCardImagePlaceholder({ label }: { label: string }) {
  return (
    <Stack spacing={0.75} alignItems="center">
      <Typography
        sx={{
          color: "rgba(17, 36, 34, 0.32)",
          fontSize: "28px",
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        404
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: "rgba(17, 36, 34, 0.54)",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

export { ClothingCardImagePlaceholder };
