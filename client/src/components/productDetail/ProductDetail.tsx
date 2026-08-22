import type { ReactElement } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
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
  bodyBottomPadding?: number;
  mobileBackAction?: (() => void) | null;
  reserveHeaderActionsSpace?: boolean;
  showImage?: boolean;
  fallbackToLargestThumbnail?: boolean;
  onRemoveFromPersonalItems?: (item: ProductDetailItem) => Promise<void> | void;
  onEditUploadedWardrobeItem?: (item: ProductDetailItem) => void;
  onSetItemLike?: (
    item: ProductDetailItem,
    isLiked: boolean,
  ) => Promise<void> | void;
  onSaveToPersonalItems?: (item: ProductDetailItem) => Promise<void> | void;
};

function ProductDetail({
  item,
  t,
  locale,
  linkTitle = true,
  bodyBottomPadding = 0,
  mobileBackAction = null,
  reserveHeaderActionsSpace = false,
  showImage = true,
  fallbackToLargestThumbnail = false,
  onRemoveFromPersonalItems,
  onEditUploadedWardrobeItem,
  onSetItemLike,
  onSaveToPersonalItems,
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
    <Stack
      data-testid="product-detail-content"
      spacing={2.2}
      sx={{ height: "100%", minHeight: 0, pb: bodyBottomPadding }}
    >
      <ProductHeader
        item={normalizedItem}
        t={t}
        locale={locale}
        linkTitle={linkTitle}
        mobileBackAction={mobileBackAction}
        reserveHeaderActionsSpace={reserveHeaderActionsSpace}
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
        onRemoveFromPersonalItems={onRemoveFromPersonalItems}
        onSetItemLike={onSetItemLike}
        onSaveToPersonalItems={onSaveToPersonalItems}
      />
      {normalizedItem.description ? (
        <Typography variant="body1" color="text.secondary">
          {normalizedItem.description}
        </Typography>
      ) : null}
      <ProductDetailGroups item={normalizedItem} t={t} locale={locale} />
      {showImage ? (
        <ProductImage
          item={normalizedItem}
          t={t}
          bottomMargin={bodyBottomPadding}
          fallbackToLargestThumbnail={fallbackToLargestThumbnail}
        />
      ) : null}
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
  onRemoveFromPersonalItems,
  onEditUploadedWardrobeItem,
  onSetItemLike,
  onSaveToPersonalItems,
}: Required<Pick<ProductDetailProps, "item" | "t" | "locale">> &
  Pick<
    ProductDetailProps,
    | "linkTitle"
    | "mobileBackAction"
    | "reserveHeaderActionsSpace"
    | "onEditUploadedWardrobeItem"
    | "onRemoveFromPersonalItems"
    | "onSetItemLike"
    | "onSaveToPersonalItems"
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
        onRemoveFromPersonalItems={onRemoveFromPersonalItems}
        onSetItemLike={onSetItemLike}
        onSaveToPersonalItems={onSaveToPersonalItems}
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
  onRemoveFromPersonalItems,
  onEditUploadedWardrobeItem,
  onSetItemLike,
  onSaveToPersonalItems,
}: {
  item: ProductDetailItem;
  linkTitle: boolean;
  mobileBackAction?: (() => void) | null;
  productUrl: string | null;
  t: ProductDetailProps["t"];
  onEditUploadedWardrobeItem?: ProductDetailProps["onEditUploadedWardrobeItem"];
  onRemoveFromPersonalItems?: ProductDetailProps["onRemoveFromPersonalItems"];
  onSetItemLike?: ProductDetailProps["onSetItemLike"];
  reserveHeaderActionsSpace?: ProductDetailProps["reserveHeaderActionsSpace"];
  onSaveToPersonalItems?: ProductDetailProps["onSaveToPersonalItems"];
}) {
  const isSaved =
    isSavedToWardrobe(item) ||
    Boolean(onRemoveFromPersonalItems && !onSaveToPersonalItems);
  const shouldShowActionsMenu = Boolean(
    onSaveToPersonalItems ||
    onRemoveFromPersonalItems ||
    onEditUploadedWardrobeItem ||
    onSetItemLike,
  );

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", pr: reserveHeaderActionsSpace ? 6 : 0 }}
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
          onRemoveFromPersonalItems={onRemoveFromPersonalItems}
          onSetItemLike={onSetItemLike}
          onSaveToPersonalItems={onSaveToPersonalItems}
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
  const likedLabel = t("wardrobe.likedBadge");
  const savedLabel = t("wardrobe.savedBadge");
  const uploadedLabel = t("wardrobe.filters.uploaded");
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
        {item.isLiked ? <LikedTitleIcon label={likedLabel} /> : null}
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

function LikedTitleIcon({ label }: { label: string }) {
  return (
    <FavoriteRoundedIcon
      className="catalog-detail-liked-icon"
      titleAccess={label}
      aria-label={label}
      sx={{
        color: "var(--cw-color-liked-indicator, #c62828)",
        display: "inline-block",
        fontSize: 20,
        mr: 0.6,
        verticalAlign: "-0.12em",
      }}
    />
  );
}

function SavedToWardrobeTitleIcon({ label }: { label: string }) {
  return (
    <BookmarkBorderRoundedIcon
      className="catalog-detail-saved-icon"
      titleAccess={label}
      aria-label={label}
      sx={{
        color: "var(--cw-color-product-saved-indicator)",
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
        color: "var(--cw-color-product-saved-indicator)",
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
