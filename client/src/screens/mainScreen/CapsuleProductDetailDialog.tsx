import { Dialog, DialogContent } from "@mui/material";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import ProductDetail from "../../components/productDetail/ProductDetail";
import {
  DesktopProductDetailPane,
  getDialogContentSx,
  getDialogPaperSx,
  useResolvedProductDetailItem,
} from "../../components/productDetail/ProductDetailDialog";
import ProductDetailLoadingContent from "../../components/productDetail/ProductDetailLoadingContent";
import ProductDetailMobileDialogHeader from "../../components/productDetail/ProductDetailMobileDialogHeader";
import ProductDialogImagePane from "../../components/productDetail/ProductDialogImagePane";
import UploadedProductDetailMobileDialogHeader from "../../components/productDetail/UploadedProductDetailMobileDialogHeader";
import {
  UploadedCapsuleEditDialogBody,
  UploadedCapsuleEditPane,
} from "./CapsuleProductUploadedEdit";
import type { DialogsProps } from "./MainScreenDialogsTypes";

type ProductDetailMode = "read" | "edit";
type ProductDetailItem = NonNullable<DialogsProps["productDetailItem"]>;
type Translate = (key: string, params?: Record<string, unknown>) => string;

type CapsuleProductDetailDialogProps = {
  item: ProductDetailItem;
  isMobile: boolean;
  locale: string;
  mode: ProductDetailMode;
  open: boolean;
  t: Translate;
  onApply: (
    item: ProductDetailItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<void> | void;
  onClose: () => void;
  onEdit: (item: ProductDetailItem) => void;
  onRemoveFromMyWardrobe?: DialogsProps["props"]["onRemoveFromMyWardrobe"];
  onReadMode: () => void;
  onSaveToMyWardrobe?: DialogsProps["props"]["onSaveToMyWardrobe"];
  onSetItemLike?: DialogsProps["props"]["onSetItemLike"];
};

function CapsuleProductDetailDialog({
  item,
  isMobile,
  locale,
  mode,
  onApply,
  onClose,
  onEdit,
  onRemoveFromMyWardrobe,
  onReadMode,
  onSaveToMyWardrobe,
  onSetItemLike,
  open,
  t,
}: CapsuleProductDetailDialogProps) {
  const resolvedItem = useResolvedProductDetailItem(item, open);
  const detailItem = resolvedItem.item ?? item;
  const showLoading = mode === "read" && resolvedItem.isLoading;
  const showMobileHeader = isMobile && mode === "read";
  const isUploadedItem = detailItem.source === "uploaded";
  const editMode = mode === "edit" && isUploadedItem;
  const showMobileEditHeader = isMobile && editMode;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth={!isMobile}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: getProductDialogPaperSx(isMobile, showMobileEditHeader),
        },
      }}
    >
      {showMobileHeader ? (
        <ProductDetailMobileDialogHeader
          item={detailItem}
          t={t}
          onClose={onClose}
          onEditUploadedWardrobeItem={isUploadedItem ? onEdit : undefined}
          onRemoveFromMyWardrobe={
            isUploadedItem ? undefined : onRemoveFromMyWardrobe
          }
          onSaveToMyWardrobe={isUploadedItem ? undefined : onSaveToMyWardrobe}
          onSetItemLike={onSetItemLike}
        />
      ) : null}
      {showMobileEditHeader ? (
        <UploadedProductDetailMobileDialogHeader t={t} />
      ) : null}
      {showMobileEditHeader ? (
        <UploadedCapsuleEditDialogBody
          item={detailItem}
          locale={locale}
          t={t}
          onApply={onApply}
          onCancel={onReadMode}
        />
      ) : (
        <DialogContent
          sx={getDialogContentSx(isMobile, showLoading, showMobileHeader)}
        >
          <CapsuleProductDetailContent
            isLoading={showLoading}
            isMobile={isMobile}
            showMobileHeader={showMobileHeader}
            item={detailItem}
            locale={locale}
            mode={mode}
            t={t}
            onApply={onApply}
            onClose={onClose}
            onEdit={onEdit}
            onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
            onReadMode={onReadMode}
            onSaveToMyWardrobe={onSaveToMyWardrobe}
            onSetItemLike={onSetItemLike}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function CapsuleProductDetailContent({
  isLoading,
  isMobile,
  item,
  locale,
  mode,
  onApply,
  onClose,
  onEdit,
  onRemoveFromMyWardrobe,
  onReadMode,
  onSaveToMyWardrobe,
  onSetItemLike,
  showMobileHeader,
  t,
}: {
  isLoading: boolean;
  isMobile: boolean;
  item: ProductDetailItem;
  locale: string;
  mode: ProductDetailMode;
  onApply: CapsuleProductDetailDialogProps["onApply"];
  onClose: () => void;
  onEdit: (item: ProductDetailItem) => void;
  onRemoveFromMyWardrobe?: DialogsProps["props"]["onRemoveFromMyWardrobe"];
  onReadMode: () => void;
  onSaveToMyWardrobe?: DialogsProps["props"]["onSaveToMyWardrobe"];
  onSetItemLike?: DialogsProps["props"]["onSetItemLike"];
  showMobileHeader: boolean;
  t: Translate;
}) {
  const isUploadedItem = item.source === "uploaded";
  const editMode = mode === "edit" && isUploadedItem;
  const saveToWardrobe = isUploadedItem ? undefined : onSaveToMyWardrobe;
  const removeFromWardrobe = isUploadedItem
    ? undefined
    : onRemoveFromMyWardrobe;

  if (isLoading) {
    return (
      <ProductDetailLoadingContent
        mobileLayout={isMobile}
        t={t}
        onClose={onClose}
        showCloseAction={!showMobileHeader}
      />
    );
  }

  if (isMobile) {
    return (
      <ProductDetail item={item} t={t} locale={locale} bodyBottomPadding={1} />
    );
  }

  return (
    <>
      <ProductDialogImagePane item={item} t={t} />
      {editMode ? (
        <UploadedCapsuleEditPane
          item={item}
          locale={locale}
          t={t}
          onApply={onApply}
          onCancel={onReadMode}
        />
      ) : (
        <DesktopProductDetailPane
          item={item}
          locale={locale}
          t={t}
          onClose={onClose}
          onEditUploadedWardrobeItem={isUploadedItem ? onEdit : undefined}
          onRemoveFromMyWardrobe={removeFromWardrobe}
          onSaveToMyWardrobe={saveToWardrobe}
          onSetItemLike={onSetItemLike}
        />
      )}
    </>
  );
}

function getProductDialogPaperSx(isMobile: boolean, mobileEditMode: boolean) {
  const baseSx = getDialogPaperSx(isMobile);
  return mobileEditMode
    ? {
        ...baseSx,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }
    : baseSx;
}

export default CapsuleProductDetailDialog;
