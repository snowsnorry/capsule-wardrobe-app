import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";

function ClothingCard({ item }) {
  const imageUrl = item?.data?.images?.[0] || "";
  const description = item?.data?.description || "";

  return (
    <MuiLink
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 0.3,
        overflow: "hidden",
        backgroundColor: "background.paper",
        position: "relative",
        boxShadow: "0 16px 40px rgba(17, 36, 34, 0.08)",
        transition: "transform 200ms ease, box-shadow 200ms ease",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: 0.3,
          padding: "1px",
          background:
            "linear-gradient(140deg, rgba(28,124,124,0.35), rgba(240,180,41,0.35))",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          pointerEvents: "none"
        },
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 20px 50px rgba(17, 36, 34, 0.14)"
        }
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: "3 / 4",
          background:
            "radial-gradient(circle at top, rgba(28,124,124,0.12), transparent 55%), #f6f4f1",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ position: "absolute", top: 12, left: 12, zIndex: 1 }}
        >
          <Chip
            label={item.category}
            size="small"
            sx={{
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontSize: "0.65rem",
              fontWeight: 700,
              bgcolor: "rgba(28,124,124,0.12)",
              color: "primary.main"
            }}
          />
        </Stack>
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={item.label}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center"
            }}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 2
            }}
          >
            <Typography variant="body2" color="text.secondary" align="center">
              {description || item.label}
            </Typography>
          </Box>
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,12,12,0.55) 100%)"
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            p: 2
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ color: "#fff", fontWeight: 600, textShadow: "0 2px 12px rgba(0,0,0,0.45)" }}
          >
            {item.label}
          </Typography>
        </Box>
      </Box>
    </MuiLink>
  );
}

export default ClothingCard;
