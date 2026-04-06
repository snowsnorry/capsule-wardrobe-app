import { Box } from "@mui/material";
import { getProductLabelParts } from "../utils/productLabel.js";

function ProductLabelText({ item, fallbackLabel = "", suffixSx = {} }) {
  const { baseLabel, suffixLabel } = getProductLabelParts(item, fallbackLabel);
  if (!suffixLabel) {
    return baseLabel;
  }

  return (
    <>
      {baseLabel}
      <Box
        component="span"
        sx={{
          display: "inline-block",
          ml: 0.65,
          fontSize: "0.78em",
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: "0.02em",
          opacity: 0.82,
          verticalAlign: "baseline",
          whiteSpace: "nowrap",
          ...suffixSx
        }}
      >
        {suffixLabel}
      </Box>
    </>
  );
}

export default ProductLabelText;
