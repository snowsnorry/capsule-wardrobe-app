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
import { fetchProductDetailByUrl } from "../../api/search";
import { useI18n } from "../../i18n/useI18n";
import { getSafeHttpUrl } from "../../../../shared/urlSecurity.js";
import ProductDetail from "./ProductDetail";
import type { ProductDetailItem } from "./ProductDetailModel";
import ProductDialogImagePane from "./ProductDialogImagePane";
import ProductDetailLoadingContent from "./ProductDetailLoadingContent";

type ProductDetailDialogProps = {
  item: ProductDetailItem | null;
  open: boolean;
  isMobile?: boolean;
  onClose: () => void;
  onRemoveFromMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: ProductDetailItem) => Promise<void> | void;
};

function ProductDetailDialog({
  item,
  open,
  isMobile,
  onClose,
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
      PaperProps={{ sx: getDialogPaperSx(mobileLayout) }}
    >
      <DialogContent
        sx={getDialogContentSx(mobileLayout, resolvedItem.isLoading)}
      >
        <ProductDetailDialogContent
          item={resolvedItem.item}
          isLoading={resolvedItem.isLoading}
          locale={locale}
          mobileLayout={mobileLayout}
          t={t}
          onClose={onClose}
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

function useResolvedProductDetailItem(
  item: ProductDetailItem | null,
  open: boolean,
) {
  const [fetchedItem, setFetchedItem] = useState<ProductDetailItem | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const safeUrl = getSafeHttpUrl(item?.url);

  useEffect(() => {
    let isActive = true;
    setFetchedItem(null);
    setIsLoading(false);

    if (!open || !safeUrl || hasExpandedProductDetails(item)) {
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    fetchProductDetailByUrl(safeUrl)
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
  }, [item, open, safeUrl]);

  return {
    item: mergeProductDetailItems(item, fetchedItem),
    isLoading,
  };
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
    item.formality_level,
    item.style,
    item.occasions,
    item.colorBase,
    item.color_base,
    item.pattern,
    item.finish,
    item.isNeutral,
    item.is_neutral,
    item.composition,
    item.silhouette,
    item.fit,
    item.closureType,
    item.closure_type,
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

  return {
    ...item,
    ...fetchedItem,
    isSavedToWardrobe:
      item.isSavedToWardrobe ?? fetchedItem.isSavedToWardrobe ?? null,
    is_saved_to_wardrobe:
      item.is_saved_to_wardrobe ?? fetchedItem.is_saved_to_wardrobe ?? null,
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
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: Pick<
  ProductDetailDialogProps,
  "item" | "onClose" | "onRemoveFromMyWardrobe" | "onSaveToMyWardrobe"
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
      />
    );
  }

  if (mobileLayout) {
    return (
      <ProductDetail
        item={item}
        t={t}
        locale={locale}
        mobileBackAction={onClose}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
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
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
    </>
  );
}

function DesktopProductDetailPane({
  item,
  locale,
  t,
  onClose,
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
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
    </Box>
  );
}

function getDialogPaperSx(mobileLayout: boolean) {
  if (mobileLayout) {
    return { overflowX: "hidden", backgroundColor: "background.paper" };
  }

  return {
    width: "min(1240px, 94vw)",
    height: "min(82vh, 820px)",
    maxHeight: "82vh",
    borderRadius: "18px",
    overflow: "hidden",
    backgroundColor: "background.paper",
  };
}

function getDialogContentSx(mobileLayout: boolean, isLoading: boolean) {
  if (isLoading) {
    return {
      width: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      px: 3,
      py: 3,
    };
  }

  if (mobileLayout) {
    return {
      width: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      px: 3,
      py: 3,
    };
  }

  return {
    p: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(420px, 48%) minmax(0, 1fr)",
    overflow: "hidden",
  };
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

export default ProductDetailDialog;
