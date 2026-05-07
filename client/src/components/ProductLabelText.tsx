import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { getProductLabelParts } from "../utils/productLabel";

type ProductLabelItem = Parameters<typeof getProductLabelParts>[0];

type ProductLabelTextProps = {
  item: ProductLabelItem;
  fallbackLabel?: string;
  suffixSx?: SxProps<Theme>;
};

function ProductLabelText({
  item,
  fallbackLabel = "",
  suffixSx = {},
}: ProductLabelTextProps) {
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
          ...suffixSx,
        }}
      >
        {suffixLabel}
      </Box>
    </>
  );
}

export default ProductLabelText;
