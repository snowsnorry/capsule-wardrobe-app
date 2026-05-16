import type { ReactElement } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import ProductLabelText from "../ProductLabelText";
import { translateOption } from "../../i18n";
import { isSavedToWardrobe } from "../../utils/savedWardrobeState";
import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";
import ProductActionsMenu from "./ProductActionsMenu";
import {
  normalizeProductDetailItem,
  type ProductDetailItem,
} from "./ProductDetailModel";
import { ProductDetailGroups, ProductImage } from "./ProductDetailSections";

type ProductDetailProps = {
  item: ProductDetailItem | null;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  linkTitle?: boolean;
  mobileBackAction?: (() => void) | null;
  reserveHeaderActionsSpace?: boolean;
  showImage?: boolean;
  onRemoveFromMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
  onEditUploadedWardrobeItem?: (item: ProductDetailItem) => void;
  onSaveToMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
};

function ProductDetail({
  item,
  t,
  locale,
  linkTitle = true,
  mobileBackAction = null,
  reserveHeaderActionsSpace = false,
  showImage = true,
  onRemoveFromMyWardrobe,
  onEditUploadedWardrobeItem,
  onSaveToMyWardrobe,
}: ProductDetailProps): ReactElement {
  const normalizedItem = normalizeProductDetailItem(item);

  if (!normalizedItem) {
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
        item={normalizedItem}
        t={t}
        locale={locale}
        linkTitle={linkTitle}
        mobileBackAction={mobileBackAction}
        reserveHeaderActionsSpace={reserveHeaderActionsSpace}
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
      {normalizedItem.description ? (
        <Typography variant="body1" color="text.secondary">
          {normalizedItem.description}
        </Typography>
      ) : null}
      <ProductDetailGroups item={normalizedItem} t={t} locale={locale} />
      {showImage ? <ProductImage item={normalizedItem} t={t} /> : null}
    </Stack>
  );
}

function ProductHeader({
  item,
  t,
  locale,
  linkTitle,
  mobileBackAction,
  reserveHeaderActionsSpace,
  onRemoveFromMyWardrobe,
  onEditUploadedWardrobeItem,
  onSaveToMyWardrobe,
}: Required<Pick<ProductDetailProps, "item" | "t" | "locale">> &
  Pick<
    ProductDetailProps,
    | "linkTitle"
    | "mobileBackAction"
    | "reserveHeaderActionsSpace"
    | "onEditUploadedWardrobeItem"
    | "onRemoveFromMyWardrobe"
    | "onSaveToMyWardrobe"
  >) {
  const productUrl = getSafeHttpUrl(item.url);

  return (
    <Box>
      <ProductHeaderTitleRow
        item={item}
        linkTitle={Boolean(linkTitle)}
        mobileBackAction={mobileBackAction}
        reserveHeaderActionsSpace={reserveHeaderActionsSpace}
        productUrl={productUrl}
        t={t}
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
      {item.brand ? <Typography variant="h6">{item.brand}</Typography> : null}
      {item.category ? (
        <Typography variant="body2" color="text.secondary">
          {translateOption("categories", item.category, locale)}
        </Typography>
      ) : null}
    </Box>
  );
}

function ProductHeaderTitleRow({
  item,
  linkTitle,
  mobileBackAction,
  reserveHeaderActionsSpace,
  productUrl,
  t,
  onRemoveFromMyWardrobe,
  onEditUploadedWardrobeItem,
  onSaveToMyWardrobe,
}: {
  item: ProductDetailItem;
  linkTitle: boolean;
  mobileBackAction?: (() => void) | null;
  productUrl: string | null;
  t: ProductDetailProps["t"];
  onEditUploadedWardrobeItem?: ProductDetailProps["onEditUploadedWardrobeItem"];
  onRemoveFromMyWardrobe?: ProductDetailProps["onRemoveFromMyWardrobe"];
  reserveHeaderActionsSpace?: ProductDetailProps["reserveHeaderActionsSpace"];
  onSaveToMyWardrobe?: ProductDetailProps["onSaveToMyWardrobe"];
}) {
  const isSaved =
    isSavedToWardrobe(item) ||
    Boolean(onRemoveFromMyWardrobe && !onSaveToMyWardrobe);
  const shouldShowActionsMenu = Boolean(
    onSaveToMyWardrobe || onRemoveFromMyWardrobe || onEditUploadedWardrobeItem,
  );

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ pr: reserveHeaderActionsSpace ? 6 : 0 }}
    >
      {mobileBackAction ? (
        <IconButton
          aria-label={t("search.back")}
          onClick={mobileBackAction}
          sx={{ ml: -1, flexShrink: 0 }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
      ) : null}
      <ProductTitle
        isSaved={isSaved}
        item={item}
        linkTitle={linkTitle}
        productUrl={productUrl}
        t={t}
      />
      <ProductHeaderExternalLink
        linkTitle={linkTitle}
        productUrl={productUrl}
        t={t}
      />
      {shouldShowActionsMenu ? <Box sx={{ flex: 1, minWidth: 0 }} /> : null}
      {shouldShowActionsMenu ? (
        <ProductActionsMenu
          item={item}
          t={t}
          isSavedToWardrobe={isSaved}
          onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
          onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
          onSaveToMyWardrobe={onSaveToMyWardrobe}
        />
      ) : null}
    </Stack>
  );
}

function ProductTitle({
  isSaved,
  item,
  linkTitle,
  productUrl,
  t,
}: {
  isSaved: boolean;
  item: ProductDetailItem;
  linkTitle: boolean;
  productUrl: string | null;
  t: ProductDetailProps["t"];
}) {
  const savedLabel = t("myWardrobe.savedBadge");
  const uploadedLabel = t("myWardrobe.filters.uploaded");
  const linkProps =
    productUrl && linkTitle
      ? { href: productUrl, target: "_blank", rel: "noreferrer" }
      : {};

  return (
    <Box
      component={productUrl && linkTitle ? "a" : "div"}
      {...linkProps}
      sx={{
        color: "secondary.main",
        textDecoration: "none",
        display: "block",
        flex: "0 1 auto",
        minWidth: 0,
        "&:hover":
          productUrl && linkTitle ? { textDecoration: "underline" } : undefined,
      }}
    >
      <Typography
        component="span"
        variant="h5"
        sx={{ color: "inherit", display: "block", overflowWrap: "anywhere" }}
      >
        {item.source === "uploaded" ? (
          <UploadedWardrobeTitleIcon label={uploadedLabel} />
        ) : isSaved ? (
          <SavedToWardrobeTitleIcon label={savedLabel} />
        ) : null}
        <ProductLabelText item={item} fallbackLabel={t("search.untitled")} />
        {productUrl && linkTitle ? (
          <OpenInNewRoundedIcon sx={externalLinkIconSx} />
        ) : null}
      </Typography>
    </Box>
  );
}

function ProductHeaderExternalLink({
  linkTitle,
  productUrl,
  t,
}: {
  linkTitle: boolean;
  productUrl: string | null;
  t: ProductDetailProps["t"];
}) {
  if (!productUrl || linkTitle) {
    return null;
  }

  return (
    <IconButton
      component="a"
      href={productUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={t("search.openProductPage")}
      sx={{ flexShrink: 0 }}
    >
      <OpenInNewRoundedIcon />
    </IconButton>
  );
}

function SavedToWardrobeTitleIcon({ label }: { label: string }) {
  return (
    <BookmarkBorderRoundedIcon
      className="catalog-detail-saved-icon"
      titleAccess={label}
      aria-label={label}
      sx={{
        color: "#15766f",
        display: "inline-block",
        fontSize: 20,
        mr: 0.6,
        verticalAlign: "-0.12em",
      }}
    />
  );
}

function UploadedWardrobeTitleIcon({ label }: { label: string }) {
  return (
    <PhotoCameraOutlinedIcon
      className="catalog-detail-uploaded-icon"
      titleAccess={label}
      aria-label={label}
      sx={{
        color: "#15766f",
        display: "inline-block",
        fontSize: 20,
        mr: 0.6,
        verticalAlign: "-0.12em",
      }}
    />
  );
}

const externalLinkIconSx = {
  fontSize: 18,
  color: "inherit",
  ml: 0.6,
  verticalAlign: "middle",
  transform: "translateY(-0.04em)",
};

export default ProductDetail;
