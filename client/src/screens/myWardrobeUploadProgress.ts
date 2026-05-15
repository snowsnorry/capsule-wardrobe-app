import type { UploadWardrobeProgress } from "../api/myWardrobe";

const EMPTY_UPLOAD_PROGRESS: UploadWardrobeProgress = {
  total: 0,
  uploaded: 0,
  completedSteps: 0,
  metadataProcessed: 0,
  imageProcessed: 0,
  failed: 0,
};

export { EMPTY_UPLOAD_PROGRESS };
