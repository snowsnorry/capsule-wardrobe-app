import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import {
  getProductDetailImageUrl,
  getProductDetailRawImageUrl,
  hasUploadedProductImageVersions,
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
        <>
          <Box
            component="img"
            src={imageUrl}
            alt={label}
            onError={() => setImageFailed(true)}
            sx={imageSx}
          />
          {showImageToggle ? (
            <ProductImageVersionToggle
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
  onChange,
  t,
}: {
  imageMode: "ai" | "original";
  onChange: (value: "ai" | "original") => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={imageMode}
      aria-label={t("myWardrobe.imageVersionToggle.label")}
      onChange={(_event, value: "ai" | "original" | null) => {
        if (value) {
          onChange(value);
        }
      }}
      sx={imageVersionToggleSx}
    >
      <ToggleButton value="original">
        {t("myWardrobe.imageVersionToggle.original")}
      </ToggleButton>
      <ToggleButton value="ai">
        {t("myWardrobe.imageVersionToggle.ai")}
      </ToggleButton>
    </ToggleButtonGroup>
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
    position: "relative",
  } as const;
}

const imageSx = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
} as const;

const imageVersionToggleSx = {
  position: "absolute",
  top: 12,
  left: 12,
  bgcolor: "background.paper",
  boxShadow: "0 2px 10px rgba(17, 36, 34, 0.14)",
  "& .MuiToggleButton-root": {
    px: 1.25,
    py: 0.45,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
  },
} as const;

export { ProductImageVersionToggle };
export default ProductDialogImagePane;
