import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import { uploadWardrobeImageToR2 } from "./r2Storage.js";
import {
  type WardrobeUploadProcessingInput,
  type WardrobeUploadProcessingResult,
  type WardrobeUploadProcessingSource,
} from "./wardrobeUploadProcessingCore.js";
import {
  buildFailedProcessingResult,
  sendProcessingEvent,
  type WardrobeUploadProcessingSend,
} from "./wardrobeUploadProcessingEvents.js";
import {
  buildFileCleanup,
  normalizeUploadFile,
} from "./wardrobeUploadProcessingImages.js";

function buildFileSource(uploadedImage: {
  key: string;
  url: string;
}): WardrobeUploadProcessingSource {
  return {
    imageUrl: uploadedImage.url,
    kind: "file",
    productPageUrl: uploadedImage.url,
    rawImageUrl: uploadedImage.url,
    sourceImageKey: uploadedImage.key,
    sourceImageUrl: uploadedImage.url,
  };
}

async function processFileUploadItem({
  email,
  imageLlm,
  input,
  sendImpl,
}: {
  email: string;
  imageLlm: string;
  input: Extract<WardrobeUploadProcessingInput, { kind: "file" }>;
  sendImpl?: WardrobeUploadProcessingSend;
}): Promise<WardrobeUploadProcessingResult> {
  let analysis = null;
  let cleanup = null;
  let source: WardrobeUploadProcessingSource | null = null;

  try {
    sendProcessingEvent(sendImpl, {
      event: "item-started",
      inputIndex: input.inputIndex,
      kind: "file",
    });
    const normalizedImage = await normalizeUploadFile(input);
    const uploadedImage = await uploadWardrobeImageToR2({
      buffer: normalizedImage.buffer,
      email,
    });
    source = buildFileSource(uploadedImage);
    sendProcessingEvent(sendImpl, {
      event: "source-uploaded",
      inputIndex: input.inputIndex,
      kind: "file",
      source,
    });

    analysis = await analyzeWardrobeImageUrl({ imageUrl: uploadedImage.url });
    sendProcessingEvent(sendImpl, {
      event: "metadata-ready",
      inputIndex: input.inputIndex,
      kind: "file",
    });
    cleanup = await buildFileCleanup({
      email,
      imageLlm,
      normalizedImage,
      source,
    });
    sendProcessingEvent(sendImpl, {
      event: "image-cleaned",
      inputIndex: input.inputIndex,
      kind: "file",
    });

    sendProcessingEvent(sendImpl, {
      event: "item-complete",
      inputIndex: input.inputIndex,
      kind: "file",
      source,
    });
    return {
      analysis,
      cleanup,
      inputIndex: input.inputIndex,
      ok: true,
      source,
    };
  } catch (error) {
    const result = buildFailedProcessingResult({
      analysis,
      cleanup,
      error,
      inputIndex: input.inputIndex,
      source,
    });
    sendProcessingEvent(sendImpl, {
      event: "item-failed",
      inputIndex: input.inputIndex,
      kind: "file",
      message: result.message || undefined,
      source,
    });
    return result;
  }
}

export { processFileUploadItem };
