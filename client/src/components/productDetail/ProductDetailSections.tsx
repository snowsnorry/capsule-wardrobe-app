import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { translateOption } from "../../i18n";
import { getColorSwatchStyle } from "../../../../shared/colorSwatches.js";
import { buildProductDetailGroups } from "../../../../shared/productDetail.js";
import {
  getProductDetailImageUrl,
  getProductDetailRawImageUrl,
  hasUploadedProductImageVersions,
  type ProductDetailItem,
} from "./ProductDetailModel";
import { ProductImageVersionToggle } from "./ProductDialogImagePane";

type ProductDetailSectionsProps = {
  item: ProductDetailItem;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
};

function ProductDetailGroups({ item, t, locale }: ProductDetailSectionsProps) {
  const detailGroups = buildProductDetailGroups(item, {
    t,
    translateOption,
    locale,
  });
  const detailGroupBackground = "var(--cw-color-product-detail-wash)";

  return (
    <Stack spacing={1.4}>
      {detailGroups.map((group) => (
        <Box
          key={group.id}
          data-testid={`product-detail-group-${group.id}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
            p: 1.8,
            borderRadius: "var(--cw-radius-detail)",
            border: "1px solid",
            borderColor: "divider",
            backgroundColor: detailGroupBackground,
          }}
        >
          {group.items.map((row) => (
            <Box key={row.key}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.35 }}
              >
                {row.label}
              </Typography>
              <Typography
                component="div"
                variant="body2"
                sx={{
                  lineHeight: 1.45,
                  fontVariantNumeric:
                    row.key === "price" ? "tabular-nums" : undefined,
                }}
              >
                {row.value.kind === "colors" ? (
                  <ColorValues values={row.value.items} />
                ) : (
                  row.value.text
                )}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Stack>
  );
}

function ColorValues({
  values,
}: {
  values: Array<{ key: string; label: string }>;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.9}
      useFlexGap
      sx={{ alignItems: "center", flexWrap: "wrap" }}
    >
      {values.map((value) => (
        <Stack
          key={value.key}
          direction="row"
          spacing={0.7}
          sx={{ alignItems: "center" }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "var(--cw-radius-pill)",
              boxSizing: "border-box",
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
              ...getColorSwatchStyle(value.key),
            }}
          />
          <span>{value.label}</span>
        </Stack>
      ))}
    </Stack>
  );
}

function ProductImage({
  bottomMargin = 0,
  item,
  t,
}: {
  bottomMargin?: number;
  item: ProductDetailItem;
  t: ProductDetailSectionsProps["t"];
}) {
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

  if (!imageUrl || imageFailed) {
    return null;
  }

  return (
    <Box data-testid="product-detail-image-wrapper">
      <Box sx={{ position: "relative" }}>
        <Box
          component="img"
          src={imageUrl}
          alt={item.name || ""}
          onError={() => setImageFailed(true)}
          sx={{
            display: "block",
            width: "100%",
            mb: bottomMargin,
            borderRadius: "var(--cw-radius-detail)",
            border: "1px solid",
            borderColor: "divider",
            objectFit: "cover",
            backgroundColor: "background.default",
          }}
        />
        {showImageToggle ? (
          <ProductImageVersionToggle
            imageMode={imageMode}
            t={t}
            onChange={setImageMode}
          />
        ) : null}
      </Box>
    </Box>
  );
}

export { ProductDetailGroups, ProductImage };
