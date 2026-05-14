import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  getProductDetailImageUrl,
  type ProductDetailItem,
} from "./ProductDetailModel";

type ProductDialogImagePaneProps = {
  item: ProductDetailItem | null;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductDialogImagePane({
  item,
  t,
}: ProductDialogImagePaneProps): ReactElement {
  const theme = useTheme();
  const imageUrl = getProductDetailImageUrl(item);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const imageSurface =
    theme.palette.mode === "dark"
      ? theme.palette.background.default
      : "#f7f5f1";
  const label = item?.name || t("search.untitled");

  return (
    <Box
      data-testid="product-detail-dialog-image-pane"
      sx={imagePaneSx(imageSurface)}
    >
      {imageUrl && !imageFailed ? (
        <Box
          component="img"
          src={imageUrl}
          alt={label}
          onError={() => setImageFailed(true)}
          sx={imageSx}
        />
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ px: 3, overflowWrap: "anywhere" }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}

function imagePaneSx(imageSurface: string) {
  return {
    minHeight: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: "1px solid",
    borderColor: "divider",
    bgcolor: imageSurface,
    overflow: "hidden",
  } as const;
}

const imageSx = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
} as const;

export default ProductDialogImagePane;
