import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  Typography,
} from "@mui/material";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import { mobileCapsuleDialogActionsSx } from "../../components/MobileDialogSurfaceStyles";
import { getDialogContentSx } from "../../components/productDetail/ProductDetailDialog";
import UploadedProductDetailForm from "../../components/productDetail/UploadedProductDetailForm";
import {
  buildFormState,
  buildPayload,
  getMissingRequiredFields,
} from "../../components/productDetail/UploadedProductDetailFormState";
import type { DialogsProps } from "./MainScreenDialogsTypes";

type ProductDetailItem = NonNullable<DialogsProps["productDetailItem"]>;
type Translate = (key: string, params?: Record<string, unknown>) => string;
type UploadedCapsuleEditApply = (
  item: ProductDetailItem,
  payload: UploadedWardrobeItemUpdatePayload,
) => Promise<void> | void;

type UploadedCapsuleEditProps = {
  item: ProductDetailItem;
  locale: string;
  onApply: UploadedCapsuleEditApply;
  onCancel: () => void;
  t: Translate;
};

export function UploadedCapsuleEditPane({
  item,
  locale,
  onApply,
  onCancel,
  t,
}: UploadedCapsuleEditProps) {
  const editState = useUploadedCapsuleEditState(item, t, onApply);

  return (
    <Box sx={uploadedEditPaneSx}>
      <Box
        data-testid="uploaded-capsule-edit-form-scroll"
        sx={uploadedEditFormScrollSx}
      >
        <UploadedProductDetailForm
          form={editState.form}
          locale={locale}
          showTitle
          topOffset={0}
          t={t}
          onChange={editState.setForm}
        />
      </Box>
      <DialogActions sx={uploadedEditActionsSx}>
        {editState.missingRequired.length > 0 ? (
          <Typography
            variant="caption"
            color="warning.dark"
            sx={{ mr: "auto" }}
          >
            {t("wardrobe.uploadedDetail.missingRequired", {
              items: editState.missingRequired.join(", "),
            })}
          </Typography>
        ) : (
          <Box sx={{ flex: 1 }} />
        )}
        <Button onClick={onCancel} disabled={editState.isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={editState.handleApply}
          disabled={!editState.canApply}
        >
          {t("filters.apply")}
        </Button>
      </DialogActions>
    </Box>
  );
}

export function UploadedCapsuleEditDialogBody({
  item,
  locale,
  onApply,
  onCancel,
  t,
}: UploadedCapsuleEditProps) {
  const editState = useUploadedCapsuleEditState(item, t, onApply);

  return (
    <>
      <DialogContent sx={uploadedEditMobileContentSx}>
        <Box sx={uploadedEditFormPaneSx}>
          <UploadedProductDetailForm
            form={editState.form}
            locale={locale}
            showTitle={false}
            topOffset={0.75}
            t={t}
            onChange={editState.setForm}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={uploadedEditMobileActionsSx}>
        <Box sx={uploadedEditActionsStackSx}>
          <Button onClick={onCancel} disabled={editState.isSaving}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={editState.handleApply}
            disabled={!editState.canApply}
          >
            {t("filters.apply")}
          </Button>
        </Box>
        {editState.missingRequired.length > 0 ? (
          <Typography variant="caption" color="warning.dark">
            {t("wardrobe.uploadedDetail.missingRequired", {
              items: editState.missingRequired.join(", "),
            })}
          </Typography>
        ) : null}
      </DialogActions>
    </>
  );
}

function useUploadedCapsuleEditState(
  item: ProductDetailItem,
  t: Translate,
  onApply: UploadedCapsuleEditApply,
) {
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

  return {
    canApply,
    form,
    handleApply,
    isSaving,
    missingRequired,
    setForm,
  };
}

const uploadedEditMobileContentSx = {
  ...getDialogContentSx(true, false, true),
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  pb: 3,
} as const;

const uploadedEditMobileActionsSx = {
  ...mobileCapsuleDialogActionsSx,
  flexDirection: "column",
  alignItems: "flex-end",
} as const;

const uploadedEditFormPaneSx = {
  minHeight: 0,
  overflowY: "visible",
  p: 0,
} as const;

const uploadedEditActionsStackSx = {
  display: "flex",
  flexDirection: "row",
  gap: 1.5,
  justifyContent: "flex-end",
} as const;

const uploadedEditPaneSx = {
  minHeight: 0,
  height: "100%",
  maxHeight: "100%",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  p: { xs: 0, md: 3 },
  pb: { xs: 1, md: 3 },
} as const;

const uploadedEditFormScrollSx = {
  minHeight: 0,
  flex: 1,
  overflowY: "auto",
} as const;

const uploadedEditActionsSx = {
  borderTop: "1px solid",
  borderColor: "divider",
  bgcolor: "transparent",
  flexShrink: 0,
  px: 0,
  pb: 0,
  pt: 2,
  mt: 2,
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 1,
} as const;
