import { useEffect, useState } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
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
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const detailGroupBackground = isDarkMode
    ? theme.palette.background.paper
    : "rgba(252, 251, 249, 0.72)";

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
            borderRadius: "22px",
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
                sx={{ lineHeight: 1.45 }}
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
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      {values.map((value) => (
        <Stack
          key={value.key}
          direction="row"
          spacing={0.7}
          alignItems="center"
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "999px",
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
  item,
  t,
}: {
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
    <Box sx={{ position: "relative" }}>
      <Box
        component="img"
        src={imageUrl}
        alt={item.name || ""}
        onError={() => setImageFailed(true)}
        sx={{
          width: "100%",
          borderRadius: "22px",
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
  );
}

export { ProductDetailGroups, ProductImage };
