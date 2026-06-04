import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  useMediaQuery,
} from "@mui/material";
import { fetchUploadedWardrobeItemDetail } from "../../api/myWardrobe";
import { fetchProductDetailByUrl } from "../../api/search";
import { useI18n } from "../../i18n/useI18n";
import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";
import ProductDetail from "./ProductDetail";
import type { ProductDetailItem } from "./ProductDetailModel";
import {
  getDialogContentSx,
  getDialogPaperSx,
} from "./ProductDetailDialogSurface";
import ProductDialogImagePane from "./ProductDialogImagePane";
import ProductDetailLoadingContent from "./ProductDetailLoadingContent";
import ProductDetailMobileDialogHeader from "./ProductDetailMobileDialogHeader";

type ProductDetailDialogProps = {
  item: ProductDetailItem | null;
  open: boolean;
  isMobile?: boolean;
  onClose: () => void;
  onEditUploadedWardrobeItem?: (item: ProductDetailItem) => void;
  onRemoveFromMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
};

function ProductDetailDialog({
  item,
  open,
  isMobile,
  onClose,
  onEditUploadedWardrobeItem,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: ProductDetailDialogProps): ReactElement {
  const { t, locale } = useI18n();
  const fallbackMobile = useMediaQuery("(max-width: 899.95px)");
  const mobileLayout = isMobile ?? fallbackMobile;
  const resolvedItem = useResolvedProductDetailItem(item, open);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={mobileLayout}
      fullWidth={!mobileLayout}
      maxWidth={false}
      slotProps={{ paper: { sx: getDialogPaperSx(mobileLayout) } }}
    >
      {mobileLayout ? (
        <ProductDetailMobileDialogHeader
          item={resolvedItem.item}
          t={t}
          onClose={onClose}
          onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
          onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
          onSaveToMyWardrobe={onSaveToMyWardrobe}
        />
      ) : null}
      <DialogContent
        sx={getDialogContentSx(
          mobileLayout,
          resolvedItem.isLoading,
          mobileLayout,
        )}
      >
        <ProductDetailDialogContent
          item={resolvedItem.item}
          isLoading={resolvedItem.isLoading}
          locale={locale}
          mobileLayout={mobileLayout}
          t={t}
          onClose={onClose}
          onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
          onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
          onSaveToMyWardrobe={onSaveToMyWardrobe}
        />
      </DialogContent>
    </Dialog>
  );
}

type ProductDetailResponse = {
  item?: ProductDetailItem | null;
};

export function useResolvedProductDetailItem(
  item: ProductDetailItem | null,
  open: boolean,
) {
  const [fetchedItem, setFetchedItem] = useState<ProductDetailItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const safeUrl = getSafeHttpUrl(item?.url);
  const uploadedDetailId = getUploadedWardrobeDetailId(item);

  useEffect(() => {
    let isActive = true;
    setFetchedItem(null);
    setIsLoading(false);

    if (!open || hasExpandedProductDetails(item)) {
      return () => {
        isActive = false;
      };
    }

    const detailRequest = uploadedDetailId
      ? fetchUploadedWardrobeItemDetail(uploadedDetailId)
      : safeUrl
        ? fetchProductDetailByUrl(safeUrl)
        : null;
    if (!detailRequest) {
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    detailRequest
      .then((response: ProductDetailResponse) => {
        if (isActive) {
          setFetchedItem(response.item || null);
        }
      })
      .catch(() => {
        if (isActive) {
          setFetchedItem(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [item, open, safeUrl, uploadedDetailId]);

  return {
    item: mergeProductDetailItems(item, fetchedItem),
    isLoading,
  };
}

// eslint-disable-next-line complexity
function getUploadedWardrobeDetailId(item: ProductDetailItem | null) {
  const explicitId = item?.wardrobeId;
  if (explicitId !== null && explicitId !== undefined && explicitId !== "") {
    return String(explicitId);
  }

  const itemUrl = String(item?.url || "").trim();
  const wardrobeUrlMatch = itemUrl.match(/^wardrobe:\/\/(.+)$/i);
  if (wardrobeUrlMatch?.[1]) {
    return decodeURIComponent(wardrobeUrlMatch[1].replace(/^\/+/, ""));
  }

  return item?.source === "uploaded" && item?.id != null ? String(item.id) : "";
}

function hasExpandedProductDetails(item: ProductDetailItem | null) {
  if (!item) {
    return false;
  }

  return [
    item.price,
    item.availability,
    item.season,
    item.formalityLevel,
    item.style,
    item.occasions,
    item.colorBase,
    item.pattern,
    item.finish,
    item.isNeutral,
    item.composition,
    item.silhouette,
    item.fit,
    item.closureType,
  ].some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined && value !== "",
  );
}

function mergeProductDetailItems(
  item: ProductDetailItem | null,
  fetchedItem: ProductDetailItem | null,
) {
  if (!item || !fetchedItem) {
    return item;
  }

  const isUploadedWardrobeItem =
    item.source === "uploaded" || fetchedItem.source === "uploaded";

  return {
    ...item,
    ...fetchedItem,
    id: isUploadedWardrobeItem ? item.id : fetchedItem.id,
    wardrobeId: isUploadedWardrobeItem
      ? (item.wardrobeId ?? fetchedItem.id)
      : fetchedItem.wardrobeId,
    isSavedToWardrobe:
      item.isSavedToWardrobe ?? fetchedItem.isSavedToWardrobe ?? null,
    savedToMyWardrobe:
      item.savedToMyWardrobe ?? fetchedItem.savedToMyWardrobe ?? null,
  };
}

function ProductDetailDialogContent({
  item,
  isLoading,
  locale,
  mobileLayout,
  t,
  onClose,
  onEditUploadedWardrobeItem,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: Pick<
  ProductDetailDialogProps,
  | "item"
  | "onClose"
  | "onEditUploadedWardrobeItem"
  | "onRemoveFromMyWardrobe"
  | "onSaveToMyWardrobe"
> & {
  isLoading: boolean;
  locale: string;
  mobileLayout: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  if (isLoading) {
    return (
      <ProductDetailLoadingContent
        mobileLayout={mobileLayout}
        t={t}
        onClose={onClose}
        showCloseAction={!mobileLayout}
      />
    );
  }

  if (mobileLayout) {
    return (
      <ProductDetail item={item} t={t} locale={locale} bodyBottomPadding={1} />
    );
  }

  return (
    <>
      <ProductDialogImagePane item={item} t={t} />
      <DesktopProductDetailPane
        item={item}
        locale={locale}
        t={t}
        onClose={onClose}
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
    </>
  );
}

export function DesktopProductDetailPane({
  item,
  locale,
  t,
  onClose,
  onEditUploadedWardrobeItem,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: Omit<ProductDetailDialogProps, "open" | "isMobile"> & {
  locale: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <Box sx={desktopDetailPaneSx}>
      <IconButton
        aria-label={t("actions.close")}
        onClick={onClose}
        sx={desktopCloseButtonSx}
      >
        <CloseRoundedIcon />
      </IconButton>
      <ProductDetail
        item={item}
        t={t}
        locale={locale}
        showImage={false}
        reserveHeaderActionsSpace
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
    </Box>
  );
}

const desktopDetailPaneSx = {
  position: "relative",
  minHeight: 0,
  overflowY: "auto",
  pl: { md: 3.5, lg: 4 },
  pr: { md: 2.5, lg: 3 },
  py: 4,
} as const;

const desktopCloseButtonSx = {
  position: "absolute",
  top: 22,
  right: 20,
  zIndex: 1,
  bgcolor: "background.paper",
  color: "text.secondary",
  border: "1px solid",
  borderColor: "divider",
  "&:hover": {
    bgcolor: "background.default",
    color: "text.primary",
  },
} as const;

export { getDialogContentSx, getDialogPaperSx };
export default ProductDetailDialog;
