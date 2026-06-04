import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
} from "../MobileDialogSurfaceStyles";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import type { ProductDetailItem } from "./ProductDetailModel";
import ProductDialogImagePane from "./ProductDialogImagePane";
import { ProductImage } from "./ProductDetailSections";
import UploadedProductDetailForm from "./UploadedProductDetailForm";
import UploadedProductDetailMobileDialogHeader from "./UploadedProductDetailMobileDialogHeader";
import {
  buildFormState,
  buildPayload,
  getMissingRequiredFields,
} from "./UploadedProductDetailFormState";

type UploadedProductDetailDialogProps = {
  item: ProductDetailItem | null;
  open: boolean;
  closeOnApply?: boolean;
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
  closeOnApply = true,
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
      if (closeOnApply) {
        onClose();
      }
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
      showTitle={!isMobile}
      topOffset={isMobile ? 0.75 : 0}
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
      slotProps={{ paper: { sx: getDialogPaperSx(isMobile) } }}
    >
      {isMobile ? <UploadedProductDetailMobileDialogHeader t={t} /> : null}
      <DialogContent sx={getDialogContentSx(isMobile)}>
        <UploadedProductDialogContent
          formContent={formContent}
          isMobile={isMobile}
          item={item}
          t={t}
        />
      </DialogContent>
      <DialogActions sx={getDialogActionsSx(isMobile)}>
        <UploadedProductDetailActions
          canApply={canApply}
          isMobile={isMobile}
          isSaving={isSaving}
          missingRequired={missingRequired}
          t={t}
          onApply={handleApply}
          onClose={onClose}
        />
      </DialogActions>
    </Dialog>
  );
}

function UploadedProductDetailActions({
  canApply,
  isMobile,
  isSaving,
  missingRequired,
  t,
  onApply,
  onClose,
}: {
  canApply: boolean;
  isMobile: boolean;
  isSaving: boolean;
  missingRequired: string[];
  t: UploadedProductDetailDialogProps["t"];
  onApply: () => void;
  onClose: () => void;
}) {
  if (!isMobile) {
    return (
      <>
        {missingRequired.length > 0 ? (
          <Typography
            variant="caption"
            color="warning.dark"
            sx={{ mr: "auto" }}
          >
            {t("wardrobe.uploadedDetail.missingRequired", {
              items: missingRequired.join(", "),
            })}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        <Button onClick={onClose} disabled={isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button variant="contained" onClick={onApply} disabled={!canApply}>
          {t("filters.apply")}
        </Button>
      </>
    );
  }

  return (
    <Stack spacing={1} sx={{ alignItems: "flex-end", width: "100%" }}>
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} disabled={isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button variant="contained" onClick={onApply} disabled={!canApply}>
          {t("filters.apply")}
        </Button>
      </Stack>
      {missingRequired.length > 0 ? (
        <Typography
          variant="caption"
          color="warning.dark"
          sx={{ alignSelf: "stretch" }}
        >
          {t("wardrobe.uploadedDetail.missingRequired", {
            items: missingRequired.join(", "),
          })}
        </Typography>
      ) : null}
    </Stack>
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
  if (isMobile) {
    return {
      ...mobileCapsuleDialogPaperSx,
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    };
  }

  return {
    width: "min(1120px, calc(100vw - 48px))",
    height: "min(820px, calc(100vh - 48px))",
    maxWidth: "none",
    borderRadius: "var(--cw-radius-card)",
    overflow: "hidden",
    backgroundColor: "background.paper",
  } as const;
}

function getDialogContentSx(isMobile: boolean) {
  if (isMobile) {
    return {
      ...mobileCapsuleDialogContentSx,
      width: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      backgroundColor: "background.default",
      px: 3,
      pt: 1,
      pb: 4,
      "&&": { pt: 1 },
    } as const;
  }

  return {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 0.9fr) 1fr",
    gap: 0,
    p: 0,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: "background.paper",
  } as const;
}

const desktopFormPaneSx = {
  minHeight: 0,
  overflowY: "auto",
  p: 3,
} as const;

const mobileImageSectionSx = {
  pb: 1,
} as const;

const dialogActionsSx = {
  borderTop: "1px solid",
  borderColor: "divider",
  px: 3,
  py: 2,
  alignItems: "center",
  gap: 1,
} as const;

function getDialogActionsSx(isMobile: boolean) {
  return isMobile ? mobileCapsuleDialogActionsSx : dialogActionsSx;
}

export default UploadedProductDetailDialog;
