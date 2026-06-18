import { Box } from "@mui/material";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";

type ColorSwatchProps = {
  value: unknown;
  size?: number;
};

function ColorSwatch({ value, size = 14 }: ColorSwatchProps) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        borderRadius: "999px",
        boxSizing: "border-box",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        p: "1px",
      }}
    >
      <Box
        component="span"
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: "inherit",
          display: "block",
          ...getColorSwatchStyle(value),
        }}
      />
    </Box>
  );
}

export default ColorSwatch;
