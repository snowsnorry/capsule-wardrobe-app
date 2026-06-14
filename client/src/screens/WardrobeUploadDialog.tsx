import { useRef } from "react";
import type { ChangeEvent, DragEvent, ReactElement, RefObject } from "react";
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
  type SelectedUploadFile,
} from "./WardrobeUploadDialogParts";
import { useWardrobeUploadSelection } from "./WardrobeUploadSelection";

type WardrobeUploadDialogProps = {
  isMobile: boolean;
  isUploading: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void> | void;
  open: boolean;
  progress: UploadWardrobeProgress;
  t: (key: string) => string;
};

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
  const {
    addFiles,
    error,
    files,
    isDragging,
    removeFile,
    resetDragging,
    setIsDragging,
    totalSizeLabel,
  } = useWardrobeUploadSelection({ open, t });

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files || []));
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    resetDragging();
    addFiles(Array.from(event.dataTransfer.files || []));
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
      <WardrobeUploadDialogTitle
        isMobile={isMobile}
        isUploading={isUploading}
        t={t}
        onClose={onClose}
      />
      <WardrobeUploadDialogContent
        error={error}
        files={files}
        inputRef={inputRef}
        isDragging={isDragging}
        isMobile={isMobile}
        isUploading={isUploading}
        progress={progress}
        t={t}
        totalSizeLabel={totalSizeLabel}
        onDragStateChange={setIsDragging}
        onDrop={handleDrop}
        onFileInputChange={handleFileInputChange}
        onRemoveFile={removeFile}
      />
      <WardrobeUploadDialogActions
        error={error}
        fileCount={files.length}
        isMobile={isMobile}
        isUploading={isUploading}
        t={t}
        onClose={onClose}
        onUpload={handleUpload}
      />
    </Dialog>
  );
}

function WardrobeUploadDialogTitle({
  isMobile,
  isUploading,
  onClose,
  t,
}: {
  isMobile: boolean;
  isUploading: boolean;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <DialogTitle sx={getDialogTitleSx(isMobile)}>
      <Stack spacing={0.75}>
        <Typography variant="h5">{t("wardrobe.uploadDialog.title")}</Typography>
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
  );
}

function WardrobeUploadDialogContent({
  error,
  files,
  inputRef,
  isDragging,
  isMobile,
  isUploading,
  onDragStateChange,
  onDrop,
  onFileInputChange,
  onRemoveFile,
  progress,
  t,
  totalSizeLabel,
}: {
  error: string;
  files: SelectedUploadFile[];
  inputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isMobile: boolean;
  isUploading: boolean;
  onDragStateChange: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (id: string) => void;
  progress: UploadWardrobeProgress;
  t: (key: string) => string;
  totalSizeLabel: string;
}) {
  return (
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
            onDragStateChange={onDragStateChange}
            onDrop={onDrop}
            onFileInputChange={onFileInputChange}
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
            onRemoveFile={onRemoveFile}
          />
        </>
      )}
    </DialogContent>
  );
}

function WardrobeUploadDialogActions({
  error,
  fileCount,
  isMobile,
  isUploading,
  onClose,
  onUpload,
  t,
}: {
  error: string;
  fileCount: number;
  isMobile: boolean;
  isUploading: boolean;
  onClose: () => void;
  onUpload: () => void;
  t: (key: string) => string;
}) {
  if (isUploading) {
    return null;
  }

  return (
    <DialogActions sx={getDialogActionsSx(isMobile)}>
      <Button onClick={onClose}>{t("actions.cancel")}</Button>
      <Button
        variant="contained"
        disabled={fileCount === 0 || Boolean(error)}
        onClick={onUpload}
      >
        {t("wardrobe.uploadDialog.upload")}
      </Button>
    </DialogActions>
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
