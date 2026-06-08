import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
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
import {
  SelectedFilesList,
  UploadDropzone,
  UploadProgressContent,
  formatFileSize,
  type SelectedUploadFile,
} from "./WardrobeUploadDialogParts";

type WardrobeUploadDialogProps = {
  isMobile: boolean;
  isUploading: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void> | void;
  open: boolean;
  progress: UploadWardrobeProgress;
  t: (key: string) => string;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function createUploadFile(file: File): SelectedUploadFile {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${randomId}`,
    file,
    previewUrl:
      typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : "",
  };
}

// The dialog keeps selection, drag, validation, and preview cleanup together.
// eslint-disable-next-line max-lines-per-function
function WardrobeUploadDialog({
  isMobile,
  isUploading,
  onClose,
  onUpload,
  open,
  progress,
  t,
}: WardrobeUploadDialogProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<SelectedUploadFile[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const totalSizeLabel = useMemo(
    () =>
      formatFileSize(files.reduce((sum, entry) => sum + entry.file.size, 0)),
    [files],
  );

  useEffect(() => {
    if (open) {
      return undefined;
    }

    files.forEach((entry) => {
      if (entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    });
    if (files.length > 0) {
      setFiles([]);
    }
    if (error) {
      setError("");
    }
    if (isDragging) {
      setIsDragging(false);
    }
  }, [error, files, isDragging, open]);

  const addFiles = (nextFiles: File[]) => {
    if (nextFiles.length === 0) {
      return;
    }

    if (files.length + nextFiles.length > MAX_FILES) {
      setError(t("wardrobe.uploadDialog.tooManyFiles"));
      return;
    }

    const invalidType = nextFiles.find(
      (file) => !ALLOWED_IMAGE_TYPES.has(file.type),
    );
    if (invalidType) {
      setError(t("wardrobe.uploadDialog.invalidType"));
      return;
    }

    const oversized = nextFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setError(t("wardrobe.uploadDialog.fileTooLarge"));
      return;
    }

    setError("");
    setFiles((current) => [...current, ...nextFiles.map(createUploadFile)]);
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files || []));
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  };

  const removeFile = (id: string) => {
    setFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((entry) => entry.id !== id);
    });
    setError("");
  };

  const handleUpload = () => {
    if (files.length === 0 || error) {
      return;
    }

    void onUpload(files.map((entry) => entry.file));
  };

  return (
    <Dialog
      open={open}
      onClose={isUploading ? undefined : onClose}
      fullScreen={isMobile}
      fullWidth={!isMobile}
      maxWidth={isMobile ? false : "sm"}
      slotProps={{
        paper: isMobile ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <DialogTitle sx={getDialogTitleSx(isMobile)}>
        <Stack spacing={0.75}>
          <Typography variant="h5">
            {t("wardrobe.uploadDialog.title")}
          </Typography>
          {!isMobile ? (
            <Typography variant="body2" color="text.secondary">
              {t("wardrobe.uploadDialog.body")}
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
                {t("wardrobe.uploadDialog.body")}
              </Typography>
            ) : null}
            <UploadDropzone
              inputRef={inputRef}
              isDragging={isDragging}
              t={t}
              variant={isMobile ? "mobile" : "desktop"}
              onDragStateChange={setIsDragging}
              onDrop={handleDrop}
              onFileInputChange={handleFileInputChange}
            />
            {error ? (
              <Typography role="alert" variant="body2" color="error">
                {error}
              </Typography>
            ) : null}
            <SelectedFilesList
              files={files}
              t={t}
              totalSizeLabel={totalSizeLabel}
              onRemoveFile={removeFile}
            />
          </>
        )}
      </DialogContent>
      {!isUploading ? (
        <DialogActions sx={getDialogActionsSx(isMobile)}>
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button
            variant="contained"
            disabled={files.length === 0 || Boolean(error)}
            onClick={handleUpload}
          >
            {t("wardrobe.uploadDialog.upload")}
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

export default WardrobeUploadDialog;
