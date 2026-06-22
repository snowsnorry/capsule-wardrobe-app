import { analyzeWardrobeImageUrl } from "./wardrobeImageAnalysis.js";
import { uploadWardrobeImageToR2 } from "./r2Storage.js";
import {
  downloadWardrobeImageUrl,
  type WardrobeImageUrlDownloadResult,
} from "./wardrobeImageUrlImport.js";
import {
  type WardrobeUploadProcessingCleanup,
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
  buildDirectImageCleanup,
  buildPortraitImageBuffer,
} from "./wardrobeUploadProcessingImages.js";

type DirectImageInput = Pick<
  WardrobeImageUrlDownloadResult,
  "buffer" | "imageUrl" | "originalName"
>;

function buildDirectImageSource({
  image,
  uploadedImage,
}: {
  image: DirectImageInput;
  uploadedImage: { key: string; url: string };
}): WardrobeUploadProcessingSource {
  return {
    imageUrl: uploadedImage.url,
    kind: "direct-image",
    productPageUrl: image.imageUrl,
    rawImageUrl: uploadedImage.url,
    sourceImageKey: uploadedImage.key,
    sourceImageUrl: uploadedImage.url,
  };
}

async function processDirectImageUrlItem({
  email,
  image,
  inputIndex,
  sendImpl,
}: {
  email: string;
  image: DirectImageInput;
  inputIndex: number;
  sendImpl?: WardrobeUploadProcessingSend;
}): Promise<WardrobeUploadProcessingResult> {
  let analysis = null;
  let cleanup: WardrobeUploadProcessingCleanup | null = null;
  let source: WardrobeUploadProcessingSource | null = null;

  try {
    const portraitImage = await buildPortraitImageBuffer(image);
    const uploadedImage = await uploadWardrobeImageToR2({
      buffer: portraitImage.buffer,
      email,
    });
    source = buildDirectImageSource({ image, uploadedImage });
    sendProcessingEvent(sendImpl, {
      event: "source-uploaded",
      inputIndex,
      kind: "direct-image",
      source,
    });

    analysis = await analyzeWardrobeImageUrl({ imageUrl: uploadedImage.url });
    sendProcessingEvent(sendImpl, {
      event: "metadata-ready",
      inputIndex,
      kind: "direct-image",
    });
    cleanup = await buildDirectImageCleanup({
      imageBuffer: portraitImage.buffer,
      source,
    });
    cleanup.cleanImage = {
      digest: uploadedImage.digest,
      key: uploadedImage.key,
      url: uploadedImage.url,
    };
    sendProcessingEvent(sendImpl, {
      event: "image-cleaned",
      inputIndex,
      kind: "direct-image",
    });

    return {
      analysis,
      cleanup,
      inputIndex,
      ok: true,
      source,
    };
  } catch (error) {
    const result = buildFailedProcessingResult({
      analysis,
      cleanup,
      error,
      inputIndex,
      source,
    });
    sendProcessingEvent(sendImpl, {
      event: "item-failed",
      inputIndex,
      kind: "direct-image",
      message: result.message || undefined,
      source,
    });
    return result;
  }
}

async function processUrlUploadItem({
  downloadImageImpl = downloadWardrobeImageUrl,
  email,
  input,
  processDirectImageUrlItemImpl = processDirectImageUrlItem,
  sendImpl,
}: {
  downloadImageImpl?: typeof downloadWardrobeImageUrl;
  email: string;
  input: Extract<WardrobeUploadProcessingInput, { kind: "url" }>;
  processDirectImageUrlItemImpl?: typeof processDirectImageUrlItem;
  sendImpl?: WardrobeUploadProcessingSend;
}): Promise<WardrobeUploadProcessingResult> {
  try {
    sendProcessingEvent(sendImpl, {
      event: "item-started",
      inputIndex: input.inputIndex,
      kind: "url",
    });
    const image = await downloadImageImpl({
      imageUrl: input.url,
    });
    const result = await processDirectImageUrlItemImpl({
      email,
      image,
      inputIndex: input.inputIndex,
      sendImpl,
    });

    if (result.ok) {
      sendProcessingEvent(sendImpl, {
        event: "item-complete",
        inputIndex: input.inputIndex,
        kind: result.source?.kind || "url",
        source: result.source,
      });
    }
    return result;
  } catch (error) {
    const result = buildFailedProcessingResult({
      analysis: null,
      cleanup: null,
      error,
      inputIndex: input.inputIndex,
      source: null,
    });
    sendProcessingEvent(sendImpl, {
      event: "item-failed",
      inputIndex: input.inputIndex,
      kind: "url",
      message: result.message || undefined,
    });
    return result;
  }
}

export { processUrlUploadItem };
