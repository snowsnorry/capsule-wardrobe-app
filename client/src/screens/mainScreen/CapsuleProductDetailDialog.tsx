import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from "@mui/material";
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
import UploadedProductDetailForm from "../../components/productDetail/UploadedProductDetailForm";
import UploadedProductDetailMobileDialogHeader from "../../components/productDetail/UploadedProductDetailMobileDialogHeader";
import {
  buildFormState,
  buildPayload,
  getMissingRequiredFields,
} from "../../components/productDetail/UploadedProductDetailFormState";
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
  open,
  t,
}: CapsuleProductDetailDialogProps) {
  const resolvedItem = useResolvedProductDetailItem(item, open);
  const detailItem = resolvedItem.item ?? item;
  const showLoading = mode === "read" && resolvedItem.isLoading;
  const showMobileHeader = isMobile && mode === "read";
  const isUploadedItem = detailItem.source === "uploaded";
  const showMobileEditHeader = isMobile && mode === "edit" && isUploadedItem;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth={!isMobile}
      maxWidth={false}
      PaperProps={{ sx: getDialogPaperSx(isMobile) }}
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
        />
      ) : null}
      {showMobileEditHeader ? (
        <UploadedProductDetailMobileDialogHeader t={t} />
      ) : null}
      <DialogContent
        sx={getDialogContentSx(
          isMobile,
          showLoading,
          showMobileHeader || showMobileEditHeader,
        )}
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
        />
      </DialogContent>
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
    return editMode ? (
      <UploadedCapsuleEditPane
        isMobile={isMobile}
        item={item}
        locale={locale}
        t={t}
        onApply={onApply}
        onCancel={onReadMode}
      />
    ) : (
      <ProductDetail item={item} t={t} locale={locale} bodyBottomPadding={1} />
    );
  }

  return (
    <>
      <ProductDialogImagePane item={item} t={t} />
      {editMode ? (
        <UploadedCapsuleEditPane
          isMobile={isMobile}
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
        />
      )}
    </>
  );
}

function UploadedCapsuleEditPane({
  item,
  isMobile,
  locale,
  onApply,
  onCancel,
  t,
}: {
  isMobile: boolean;
  item: ProductDetailItem;
  locale: string;
  onApply: CapsuleProductDetailDialogProps["onApply"];
  onCancel: () => void;
  t: Translate;
}) {
  const [form, setForm] = useState(() => buildFormState(item));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(buildFormState(item));
    setIsSaving(false);
  }, [item]);

  const missingRequired = useMemo(
    () => getMissingRequiredFields(form, t),
    [form, t],
  );
  const canApply = missingRequired.length === 0 && !isSaving;
  const handleApply = async () => {
    if (!canApply) {
      return;
    }

    setIsSaving(true);
    try {
      await onApply(item, buildPayload(form));
    } catch {
      // Parent screen owns the visible error message; keep edit mode open.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={uploadedEditPaneSx}>
      <UploadedProductDetailForm
        form={form}
        locale={locale}
        showTitle={!isMobile}
        topOffset={isMobile ? 0.75 : 0}
        t={t}
        onChange={setForm}
      />
      <DialogActions sx={uploadedEditActionsSx}>
        {missingRequired.length > 0 ? (
          <Typography
            variant="caption"
            color="warning.dark"
            sx={{ mr: "auto" }}
          >
            {t("myWardrobe.uploadedDetail.missingRequired", {
              items: missingRequired.join(", "),
            })}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        <Button onClick={onCancel} disabled={isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button variant="contained" onClick={handleApply} disabled={!canApply}>
          {t("filters.apply")}
        </Button>
      </DialogActions>
    </Box>
  );
}

const uploadedEditPaneSx = {
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  p: { xs: 0, md: 3 },
  pb: { xs: 1, md: 3 },
} as const;

const uploadedEditActionsSx = {
  borderTop: "1px solid",
  borderColor: "divider",
  px: 0,
  pb: 0,
  pt: 2,
  mt: 2,
  alignItems: "center",
  gap: 1,
} as const;

export default CapsuleProductDetailDialog;
