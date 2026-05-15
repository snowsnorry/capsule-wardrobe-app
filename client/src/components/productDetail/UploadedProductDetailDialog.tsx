import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from "@mui/material";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import type { ProductDetailItem } from "./ProductDetailModel";
import ProductDialogImagePane from "./ProductDialogImagePane";
import { ProductImage } from "./ProductDetailSections";
import UploadedProductDetailForm from "./UploadedProductDetailForm";
import {
  buildFormState,
  buildPayload,
  getMissingRequiredFields,
} from "./UploadedProductDetailFormState";

type UploadedProductDetailDialogProps = {
  item: ProductDetailItem | null;
  open: boolean;
  isMobile?: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  onClose: () => void;
  onApply: (
    item: ProductDetailItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<void> | void;
};

function UploadedProductDetailDialog({
  item,
  open,
  isMobile = false,
  t,
  locale,
  onClose,
  onApply,
}: UploadedProductDetailDialogProps): ReactElement {
  const [form, setForm] = useState(() => buildFormState(item));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(buildFormState(item));
    setIsSaving(false);
  }, [item, open]);

  const missingRequired = useMemo(
    () => getMissingRequiredFields(form, t),
    [form, t],
  );
  const canApply = Boolean(item) && missingRequired.length === 0 && !isSaving;
  const handleApply = async () => {
    if (!item || !canApply) {
      return;
    }

    setIsSaving(true);
    try {
      await onApply(item, buildPayload(form));
      onClose();
    } catch {
      // Keep the dialog open; the parent screen owns the visible error message.
    } finally {
      setIsSaving(false);
    }
  };
  const formContent = (
    <UploadedProductDetailForm
      form={form}
      locale={locale}
      t={t}
      onChange={setForm}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      fullScreen={isMobile}
      fullWidth={!isMobile}
      maxWidth={false}
      PaperProps={{ sx: getDialogPaperSx(isMobile) }}
    >
      <DialogContent sx={getDialogContentSx(isMobile)}>
        <UploadedProductDialogContent
          formContent={formContent}
          isMobile={isMobile}
          item={item}
          t={t}
        />
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
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
        <Button onClick={onClose} disabled={isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button variant="contained" onClick={handleApply} disabled={!canApply}>
          {t("filters.apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UploadedProductDialogContent({
  formContent,
  isMobile,
  item,
  t,
}: {
  formContent: ReactElement;
  isMobile: boolean;
  item: ProductDetailItem | null;
  t: UploadedProductDetailDialogProps["t"];
}) {
  if (isMobile) {
    return (
      <>
        {formContent}
        {item ? (
          <Box sx={mobileImageSectionSx}>
            <ProductImage item={item} t={t} />
          </Box>
        ) : null}
      </>
    );
  }

  return (
    <>
      <ProductDialogImagePane item={item} t={t} imageFit="contain" />
      <Box sx={desktopFormPaneSx}>{formContent}</Box>
    </>
  );
}

function getDialogPaperSx(isMobile: boolean) {
  return {
    width: isMobile ? "100%" : "min(1120px, calc(100vw - 48px))",
    height: isMobile ? "100%" : "min(820px, calc(100vh - 48px))",
    maxWidth: "none",
    borderRadius: isMobile ? 0 : "8px",
    overflow: "hidden",
  } as const;
}

function getDialogContentSx(isMobile: boolean) {
  return {
    display: isMobile ? "block" : "grid",
    gridTemplateColumns: isMobile ? undefined : "minmax(360px, 0.9fr) 1fr",
    gap: 0,
    p: 0,
    minHeight: 0,
    overflow: isMobile ? "auto" : "hidden",
    WebkitOverflowScrolling: isMobile ? "touch" : undefined,
  } as const;
}

const desktopFormPaneSx = {
  minHeight: 0,
  overflowY: "auto",
  p: 3,
} as const;

const mobileImageSectionSx = {
  px: 2,
  pb: 2,
} as const;

const dialogActionsSx = {
  borderTop: "1px solid",
  borderColor: "divider",
  px: 3,
  py: 2,
  alignItems: "center",
  gap: 1,
} as const;

export default UploadedProductDetailDialog;
