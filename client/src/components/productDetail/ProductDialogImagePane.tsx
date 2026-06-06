import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  getProductDetailImageUrl,
  getProductDetailRawImageUrl,
  hasUploadedProductImageVersions,
  type ProductDetailItem,
} from "./ProductDetailModel";

type ProductDialogImagePaneProps = {
  item: ProductDetailItem | null;
  edge?: "right" | "top";
  imageFit?: "contain" | "cover";
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductDialogImagePane({
  edge = "right",
  imageFit = "cover",
  item,
  t,
}: ProductDialogImagePaneProps): ReactElement {
  const [imageMode, setImageMode] = useState<"ai" | "original">("ai");
  const aiImageUrl = getProductDetailImageUrl(item);
  const rawImageUrl = getProductDetailRawImageUrl(item);
  const showImageToggle = hasUploadedProductImageVersions(item);
  const imageUrl =
    showImageToggle && imageMode === "original" ? rawImageUrl : aiImageUrl;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageMode("ai");
    setImageFailed(false);
  }, [aiImageUrl, rawImageUrl]);

  const imageSurface = "var(--cw-color-product-image-wash)";
  const label = item?.name || t("search.untitled");
  const isLiked = Boolean(item?.isLiked);

  return (
    <Box
      data-testid="product-detail-dialog-image-pane"
      sx={imagePaneSx(imageSurface, edge)}
    >
      {imageUrl && !imageFailed ? (
        <>
          <Box
            component="img"
            src={imageUrl}
            alt={label}
            onError={() => setImageFailed(true)}
            sx={imageSx(imageFit)}
          />
          {showImageToggle ? (
            <ProductImageVersionToggle
              isShifted={isLiked}
              imageMode={imageMode}
              t={t}
              onChange={setImageMode}
            />
          ) : null}
        </>
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

function ProductImageVersionToggle({
  imageMode,
  isShifted = false,
  onChange,
  t,
}: {
  imageMode: "ai" | "original";
  isShifted?: boolean;
  onChange: (value: "ai" | "original") => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={imageMode}
      aria-label={t("wardrobe.imageVersionToggle.label")}
      onChange={(_event, value: "ai" | "original" | null) => {
        if (value) {
          onChange(value);
        }
      }}
      sx={imageVersionToggleSx(isShifted)}
    >
      <ToggleButton value="original">
        {t("wardrobe.imageVersionToggle.original")}
      </ToggleButton>
      <ToggleButton value="ai">
        {t("wardrobe.imageVersionToggle.ai")}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

function imagePaneSx(imageSurface: string, edge: "right" | "top") {
  return {
    minHeight: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: edge === "right" ? "1px solid" : 0,
    borderTop: edge === "top" ? "1px solid" : 0,
    borderColor: "divider",
    bgcolor: imageSurface,
    overflow: "hidden",
    position: "relative",
  } as const;
}

function imageSx(imageFit: "contain" | "cover") {
  return {
    width: "100%",
    height: "100%",
    objectFit: imageFit,
    objectPosition: "center",
  } as const;
}

function imageVersionToggleSx(isShifted: boolean) {
  return {
    position: "absolute",
    top: 12,
    left: isShifted ? 48 : 12,
    height: 28,
    bgcolor: "background.paper",
    boxShadow: "var(--cw-shadow-image-toggle)",
    "& .MuiToggleButton-root": {
      height: 28,
      px: 1.25,
      py: 0,
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1.2,
    },
  } as const;
}

export { ProductImageVersionToggle };
export default ProductDialogImagePane;
