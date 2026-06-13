import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { UploadWardrobeProgress } from "../api/personalItems";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../components/MobileDialogSurfaceStyles";
import { UploadProgressContent } from "./WardrobeUploadDialogParts";

type WardrobeUrlUploadDialogProps = {
  isMobile: boolean;
  isUploading: boolean;
  onClose: () => void;
  onUpload: (urls: string[]) => Promise<void> | void;
  open: boolean;
  progress: UploadWardrobeProgress;
  t: (key: string) => string;
};

export const MAX_URLS = 5;

export function isValidProductUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  try {
    const url = new URL(trimmed);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getNextUrlFields(
  current: string[],
  index: number,
  value: string,
) {
  const next = [...current];
  next[index] = value;

  if (next.at(-1)?.trim() && next.length < MAX_URLS) {
    next.push("");
  }

  while (next.length > 1 && !next.at(-1)?.trim() && !next.at(-2)?.trim()) {
    next.pop();
  }

  return next.slice(0, MAX_URLS);
}

export function getFilledProductUrls(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

// URL import follows the same upload progress surface as photo import.
// eslint-disable-next-line max-lines-per-function
function WardrobeUrlUploadDialog({
  isMobile,
  isUploading,
  onClose,
  onUpload,
  open,
  progress,
  t,
}: WardrobeUrlUploadDialogProps): ReactElement {
  const [urls, setUrls] = useState<string[]>([""]);

  useEffect(() => {
    if (!open) {
      setUrls([""]);
    }
  }, [open]);

  const filledUrls = useMemo(() => getFilledProductUrls(urls), [urls]);
  const hasInvalidUrl = urls.some(
    (value) => value.trim() && !isValidProductUrl(value),
  );
  const canUpload = filledUrls.length > 0 && !hasInvalidUrl;

  const handleUpload = () => {
    if (!canUpload) {
      return;
    }

    void onUpload(filledUrls);
  };

  return (
    <Dialog
      open={open}
      onClose={isUploading ? undefined : onClose}
      aria-labelledby="wardrobe-url-upload-dialog-heading"
      fullScreen={isMobile}
      fullWidth={!isMobile}
      maxWidth={isMobile ? false : "sm"}
      slotProps={{
        paper: isMobile ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <DialogTitle
        id="wardrobe-url-upload-dialog-title"
        sx={getDialogTitleSx(isMobile)}
      >
        <Stack spacing={0.75}>
          <Typography id="wardrobe-url-upload-dialog-heading" variant="h5">
            {t("wardrobe.urlUploadDialog.title")}
          </Typography>
          {!isMobile ? (
            <Typography variant="body2" color="text.secondary">
              {t("wardrobe.urlUploadDialog.body")}
            </Typography>
          ) : null}
        </Stack>
        <IconButton
          aria-label={t("actions.close")}
          disabled={isUploading}
          onClick={onClose}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={getDialogContentSx(isMobile)}>
        {isUploading ? (
          <UploadProgressContent progress={progress} t={t} />
        ) : (
          <>
            {isMobile ? (
              <Typography variant="body2" color="text.secondary">
                {t("wardrobe.urlUploadDialog.body")}
              </Typography>
            ) : null}
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              {urls.map((value, index) => {
                const isFilled = Boolean(value.trim());
                const hasError = isFilled && !isValidProductUrl(value);
                return (
                  <TextField
                    key={index}
                    value={value}
                    autoComplete="url"
                    disabled={isUploading}
                    error={hasError}
                    fullWidth
                    label={t("wardrobe.urlUploadDialog.fieldLabel").replace(
                      "{index}",
                      String(index + 1),
                    )}
                    placeholder={t("wardrobe.urlUploadDialog.placeholder")}
                    helperText={
                      hasError
                        ? t("wardrobe.urlUploadDialog.invalidUrl")
                        : t("wardrobe.urlUploadDialog.helperText")
                    }
                    onChange={(event) =>
                      setUrls((current) =>
                        getNextUrlFields(current, index, event.target.value),
                      )
                    }
                    slotProps={{ htmlInput: { inputMode: "url" } }}
                  />
                );
              })}
            </Stack>
          </>
        )}
      </DialogContent>
      {!isUploading ? (
        <DialogActions sx={getDialogActionsSx(isMobile)}>
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button
            variant="contained"
            disabled={!canUpload}
            onClick={handleUpload}
          >
            {t("wardrobe.urlUploadDialog.upload")}
          </Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
}

function getDialogTitleSx(isMobile: boolean) {
  return isMobile ? mobileCapsuleDialogTitleSx : dialogTitleSx;
}

function getDialogContentSx(isMobile: boolean) {
  return isMobile
    ? {
        ...mobileCapsuleDialogContentSx,
        ...dialogContentSx,
        px: 2,
        pb: 2,
        overflowY: "auto",
      }
    : dialogContentSx;
}

function getDialogActionsSx(isMobile: boolean) {
  return isMobile ? mobileCapsuleDialogActionsSx : dialogActionsSx;
}

const dialogTitleSx = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 2,
  pb: 1.5,
} as const;

const dialogContentSx = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  pt: 0,
} as const;

const dialogActionsSx = {
  px: 3,
  pb: 2.5,
  justifyContent: "flex-end",
} as const;

export default WardrobeUrlUploadDialog;
