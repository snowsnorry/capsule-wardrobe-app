import { useEffect, useMemo, useState } from "react";
import {
  formatFileSize,
  type SelectedUploadFile,
} from "./WardrobeUploadDialogParts";

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

export function useWardrobeUploadSelection({
  open,
  t,
}: {
  open: boolean;
  t: (key: string) => string;
}) {
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

  return {
    addFiles,
    error,
    files,
    isDragging,
    removeFile,
    resetDragging: () => setIsDragging(false),
    setIsDragging,
    totalSizeLabel,
  };
}
