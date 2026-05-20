import type { ChangeEvent, DragEvent, RefObject } from "react";
import {
  Box,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { UploadWardrobeProgress } from "../api/myWardrobe";

type SelectedUploadFile = {
  id: string;
  file: File;
  previewUrl: string;
};

type UploadDropzoneVariant = "desktop" | "mobile";

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatUploadStatusLabel(
  t: (key: string) => string,
  key: string,
  count: number,
) {
  return t(key).replace("{image_count}", String(count));
}

function getUploadProgressValue(progress: UploadWardrobeProgress) {
  if (progress.total <= 0) {
    return undefined;
  }

  const completedSteps =
    progress.completedSteps ||
    progress.uploaded +
      progress.metadataProcessed +
      progress.imageProcessed +
      progress.failed;
  return Math.min(100, (completedSteps / (progress.total * 3)) * 100);
}

function UploadProgressContent({
  progress,
  t,
}: {
  progress: UploadWardrobeProgress;
  t: (key: string) => string;
}) {
  return (
    <Stack spacing={2} sx={{ py: 1 }}>
      <LinearProgress
        variant={progress.total > 0 ? "determinate" : "indeterminate"}
        value={getUploadProgressValue(progress)}
      />
      <Stack spacing={0.75}>
        <Typography variant="body2">
          {formatUploadStatusLabel(
            t,
            "myWardrobe.uploadDialog.uploadedStatus",
            progress.uploaded,
          )}
        </Typography>
        <Typography variant="body2">
          {formatUploadStatusLabel(
            t,
            "myWardrobe.uploadDialog.metadataProcessedStatus",
            progress.metadataProcessed,
          )}
        </Typography>
        <Typography variant="body2">
          {formatUploadStatusLabel(
            t,
            "myWardrobe.uploadDialog.imageProcessedStatus",
            progress.imageProcessed,
          )}
        </Typography>
        <Typography variant="body2" color="error">
          {formatUploadStatusLabel(
            t,
            "myWardrobe.uploadDialog.failedStatus",
            progress.failed,
          )}
        </Typography>
      </Stack>
    </Stack>
  );
}

function UploadDropzone({
  inputRef,
  isDragging,
  onDragStateChange,
  onDrop,
  onFileInputChange,
  t,
  variant = "desktop",
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  onDragStateChange: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  t: (key: string) => string;
  variant?: UploadDropzoneVariant;
}) {
  const isMobile = variant === "mobile";
  const dragHandlers = isMobile
    ? {}
    : {
        onDragEnter: (event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          onDragStateChange(true);
        },
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          onDragStateChange(true);
        },
        onDragLeave: () => onDragStateChange(false),
        onDrop,
      };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={t("myWardrobe.uploadDialog.dropzoneLabel")}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      sx={dropzoneSx(isDragging, variant)}
      {...dragHandlers}
    >
      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileInputChange}
      />
      <Box sx={dropzoneIconSx(isMobile)}>
        <AddPhotoAlternateOutlinedIcon color="primary" />
      </Box>
      <Stack spacing={0.25} sx={dropzoneTextSx(isMobile)}>
        <Typography variant="subtitle1">
          {t(
            isMobile
              ? "myWardrobe.uploadDialog.mobileDropzoneTitle"
              : "myWardrobe.uploadDialog.dropzoneTitle",
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            isMobile
              ? "myWardrobe.uploadDialog.mobileDropzoneHint"
              : "myWardrobe.uploadDialog.dropzoneHint",
          )}
        </Typography>
      </Stack>
    </Box>
  );
}

function SelectedFilesList({
  files,
  onRemoveFile,
  t,
  totalSizeLabel,
}: {
  files: SelectedUploadFile[];
  onRemoveFile: (id: string) => void;
  t: (key: string) => string;
  totalSizeLabel: string;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1} aria-label={t("myWardrobe.uploadDialog.fileList")}>
      <Typography variant="subtitle2" color="text.secondary">
        {t("myWardrobe.uploadDialog.selectedSummary")
          .replace("{count}", String(files.length))
          .replace("{size}", totalSizeLabel)}
      </Typography>
      {files.map((entry) => (
        <Stack key={entry.id} direction="row" spacing={1.25} sx={fileRowSx}>
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
            onClick={() => onRemoveFile(entry.id)}
          >
            <DeleteOutlineRoundedIcon />
          </IconButton>
        </Stack>
      ))}
    </Stack>
  );
}

const dropzoneSx = (
  isDragging: boolean,
  variant: UploadDropzoneVariant = "desktop",
) =>
  ({
    display: "flex",
    alignItems: "center",
    justifyContent: variant === "mobile" ? "center" : "flex-start",
    flexDirection: variant === "mobile" ? "column" : "row",
    textAlign: variant === "mobile" ? "center" : "left",
    gap: 1.5,
    minHeight: variant === "mobile" ? 172 : 132,
    px: variant === "mobile" ? 2.5 : 2,
    py: variant === "mobile" ? 3 : 2.25,
    borderRadius: 2,
    border: variant === "mobile" ? "1px solid" : "1px dashed",
    borderColor: isDragging ? "primary.main" : "divider",
    bgcolor:
      isDragging && variant !== "mobile" ? "primary.light" : "background.paper",
    cursor: "pointer",
    transition: "border-color 180ms ease-out, background-color 180ms ease-out",
    "&:focus-visible": {
      outline: "3px solid",
      outlineColor: "primary.main",
      outlineOffset: 3,
    },
  }) as const;

const dropzoneIconSx = (isMobile: boolean) =>
  ({
    width: isMobile ? 56 : "auto",
    height: isMobile ? 56 : "auto",
    borderRadius: "var(--cw-radius-circle)",
    bgcolor: isMobile ? "primary.light" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }) as const;

const dropzoneTextSx = (isMobile: boolean) =>
  ({
    minWidth: 0,
    maxWidth: isMobile ? 280 : "none",
  }) as const;

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
  bgcolor: "var(--cw-color-product-image-wash)",
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

export {
  SelectedFilesList,
  UploadDropzone,
  UploadProgressContent,
  formatFileSize,
};
export type { SelectedUploadFile };
