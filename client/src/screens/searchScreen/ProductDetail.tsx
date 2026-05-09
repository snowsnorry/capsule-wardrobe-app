import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, IconButton, Stack, Typography, useTheme } from "@mui/material";
import ProductLabelText from "../../components/ProductLabelText";
import { translateOption } from "../../i18n";
import {
  buildProductImageThumbnails,
  type ProductImageThumbnails,
} from "../../utils/productImageThumbnails";
import { getColorSwatchStyle } from "../../../../shared/colorSwatches.js";
import { buildProductDetailGroups } from "../../../../shared/productDetail.js";
import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";
import type { SearchResultItem } from "./searchTypes";

type ProductDetailProps = {
  item: SearchResultItem | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  mobileBackAction?: (() => void) | null;
};

type DetailGroupsProps = {
  item: SearchResultItem;
  t: ProductDetailProps["t"];
  locale: string;
};

type ProductImageSource = {
  src: string;
  srcSet?: string;
  sizes?: string;
};

function ProductDetail({
  item,
  t,
  locale,
  mobileBackAction = null,
}: ProductDetailProps): ReactElement {
  if (!item) {
    return (
      <Stack spacing={2.2} sx={{ height: "100%", minHeight: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t("search.detailEmpty")}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.2} sx={{ height: "100%", minHeight: 0 }}>
      <ProductHeader
        item={item}
        t={t}
        locale={locale}
        mobileBackAction={mobileBackAction}
      />
      {item.description ? (
        <Typography variant="body1" color="text.secondary">
          {item.description}
        </Typography>
      ) : null}
      <ProductDetailGroups item={item} t={t} locale={locale} />
      <ProductImage item={item} />
    </Stack>
  );
}

function ProductHeader({
  item,
  t,
  locale,
  mobileBackAction,
}: Required<Pick<ProductDetailProps, "item" | "t" | "locale">> &
  Pick<ProductDetailProps, "mobileBackAction">) {
  const productUrl = getSafeHttpUrl(item.url);

  return (
    <Box>
      <Box sx={{ position: "relative" }}>
        {mobileBackAction ? (
          <IconButton
            aria-label={t("search.back")}
            onClick={mobileBackAction}
            sx={{
              position: "absolute",
              top: -4,
              left: -8,
              zIndex: 1,
            }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
        ) : null}
        <Box
          component={productUrl ? "a" : "div"}
          {...(productUrl
            ? {
                href: productUrl,
                target: "_blank",
                rel: "noreferrer",
              }
            : {})}
          sx={{
            color: "secondary.main",
            textDecoration: "none",
            display: "block",
            "&:hover": productUrl ? { textDecoration: "underline" } : undefined,
          }}
        >
          <Typography
            component="span"
            variant="h5"
            sx={{
              color: "inherit",
              display: "block",
              overflowWrap: "anywhere",
              textIndent: mobileBackAction ? "40px" : 0,
            }}
          >
            <ProductLabelText
              item={item}
              fallbackLabel={t("search.untitled")}
            />
            {productUrl ? (
              <OpenInNewRoundedIcon sx={externalLinkIconSx} />
            ) : null}
          </Typography>
        </Box>
      </Box>
      {item.brand ? <Typography variant="h6">{item.brand}</Typography> : null}
      {item.category ? (
        <Typography variant="body2" color="text.secondary">
          {translateOption("categories", item.category, locale)}
        </Typography>
      ) : null}
    </Box>
  );
}

function ProductDetailGroups({ item, t, locale }: DetailGroupsProps) {
  const detailGroups = buildProductDetailGroups(item, {
    t,
    translateOption,
    locale,
  });
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  return (
    <Stack spacing={1.4}>
      {detailGroups.map((group) => (
        <Box
          key={group.id}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
            p: 1.8,
            borderRadius: "22px",
            backgroundColor: isDarkMode
              ? "background.default"
              : "var(--cw-color-surface-warm)",
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

function ProductImage({ item }: { item: SearchResultItem }) {
  const imageUrl = getSafeHttpUrl(item.imageUrl);
  const [displayImageSource, setDisplayImageSource] =
    useState<ProductImageSource | null>(null);
  const [imageMode, setImageMode] = useState<
    "loading" | "thumbnail" | "original" | "missing"
  >("loading");

  useEffect(() => {
    let isActive = true;

    setDisplayImageSource(null);
    setImageMode(imageUrl ? "loading" : "missing");

    if (!imageUrl) {
      return () => {
        isActive = false;
      };
    }

    buildProductImageThumbnails(item?.imageUrl).then((thumbnails) => {
      if (!isActive) {
        return;
      }

      if (thumbnails) {
        setDisplayImageSource(toProductImageSource(thumbnails));
        setImageMode("thumbnail");
      } else {
        setDisplayImageSource({ src: imageUrl });
        setImageMode("original");
      }
    });

    return () => {
      isActive = false;
    };
  }, [imageUrl, item?.imageUrl]);

  const handleImageError = () => {
    if (imageMode === "thumbnail" && imageUrl) {
      setDisplayImageSource({ src: imageUrl });
      setImageMode("original");
      return;
    }

    setDisplayImageSource(null);
    setImageMode("missing");
  };

  if (!displayImageSource) {
    return null;
  }

  return (
    <Box
      component="img"
      src={displayImageSource.src}
      srcSet={displayImageSource.srcSet}
      sizes={displayImageSource.sizes}
      alt={item.name || ""}
      onError={handleImageError}
      sx={{
        width: "100%",
        borderRadius: "22px",
        border: "1px solid",
        borderColor: "divider",
        objectFit: "cover",
        backgroundColor: "background.default",
      }}
    />
  );
}

function toProductImageSource(
  thumbnails: ProductImageThumbnails,
): ProductImageSource {
  return {
    src: thumbnails.src,
    srcSet: thumbnails.srcSet,
    sizes: thumbnails.sizes,
  };
}

const externalLinkIconSx = {
  fontSize: 18,
  color: "inherit",
  ml: 0.6,
  verticalAlign: "middle",
  transform: "translateY(-0.04em)",
};

export default ProductDetail;
