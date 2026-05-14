import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactElement } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

type WardrobeUploadDialogProps = {
  isUploading: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void> | void;
  open: boolean;
  t: (key: string) => string;
};

type SelectedUploadFile = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  isUploading,
  onClose,
  onUpload,
  open,
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
      setError(t("myWardrobe.uploadDialog.tooManyFiles"));
      return;
    }

    const invalidType = nextFiles.find(
      (file) => !ALLOWED_IMAGE_TYPES.has(file.type),
    );
    if (invalidType) {
      setError(t("myWardrobe.uploadDialog.invalidType"));
      return;
    }

    const oversized = nextFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setError(t("myWardrobe.uploadDialog.fileTooLarge"));
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={dialogTitleSx}>
        <Stack spacing={0.75}>
          <Typography variant="h5">
            {t("myWardrobe.uploadDialog.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("myWardrobe.uploadDialog.body")}
          </Typography>
        </Stack>
        <IconButton aria-label={t("actions.close")} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={dialogContentSx}>
        <Box
          role="button"
          tabIndex={0}
          aria-label={t("myWardrobe.uploadDialog.dropzoneLabel")}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          sx={dropzoneSx(isDragging)}
        >
          <input
            ref={inputRef}
            hidden
            multiple
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInputChange}
          />
          <AddPhotoAlternateOutlinedIcon color="primary" />
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1">
              {t("myWardrobe.uploadDialog.dropzoneTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("myWardrobe.uploadDialog.dropzoneHint")}
            </Typography>
          </Stack>
        </Box>
        {error ? (
          <Typography role="alert" variant="body2" color="error">
            {error}
          </Typography>
        ) : null}
        {files.length > 0 ? (
          <Stack spacing={1} aria-label={t("myWardrobe.uploadDialog.fileList")}>
            <Typography variant="subtitle2" color="text.secondary">
              {t("myWardrobe.uploadDialog.selectedSummary")
                .replace("{count}", String(files.length))
                .replace("{size}", totalSizeLabel)}
            </Typography>
            {files.map((entry) => (
              <Stack
                key={entry.id}
                direction="row"
                spacing={1.25}
                sx={fileRowSx}
              >
                <Box sx={previewSx}>
                  {entry.previewUrl ? (
                    <Box
                      component="img"
                      src={entry.previewUrl}
                      alt=""
                      sx={previewImageSx}
                    />
                  ) : (
                    <ImageOutlinedIcon fontSize="small" />
                  )}
                </Box>
                <Stack spacing={0.15} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    {entry.file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(entry.file.size)}
                  </Typography>
                </Stack>
                <IconButton
                  aria-label={t("myWardrobe.uploadDialog.removeFile").replace(
                    "{name}",
                    entry.file.name,
                  )}
                  onClick={() => removeFile(entry.id)}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <Button
          variant="contained"
          disabled={files.length === 0 || Boolean(error) || isUploading}
          onClick={handleUpload}
        >
          {t("myWardrobe.uploadDialog.upload")}
        </Button>
      </DialogActions>
    </Dialog>
  );
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

function dropzoneSx(isDragging: boolean) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minHeight: 132,
    px: 2,
    py: 2.25,
    borderRadius: 2,
    border: "1px dashed",
    borderColor: isDragging ? "primary.main" : "divider",
    bgcolor: isDragging ? "primary.light" : "background.default",
    cursor: "pointer",
    transition: "border-color 180ms ease-out, background-color 180ms ease-out",
    "&:focus-visible": {
      outline: "3px solid",
      outlineColor: "primary.main",
      outlineOffset: 3,
    },
  } as const;
}

const fileRowSx = {
  alignItems: "center",
  px: 1,
  py: 0.75,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  bgcolor: "background.paper",
} as const;

const previewSx = {
  width: 48,
  height: 60,
  flex: "0 0 auto",
  borderRadius: 1,
  overflow: "hidden",
  bgcolor: "#f7f5f1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "text.secondary",
} as const;

const previewImageSx = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
} as const;

const dialogActionsSx = {
  px: 3,
  pb: 2.5,
} as const;

export default WardrobeUploadDialog;
