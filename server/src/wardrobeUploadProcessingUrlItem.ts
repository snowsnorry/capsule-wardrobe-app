import {
  analyzeWardrobeImageUrl,
  analyzeWardrobeProductPageImage,
} from "./wardrobeImageAnalysis.js";
import { cleanupUploadedWardrobeItemImage } from "./wardrobeImageCleanup.js";
import { uploadWardrobeImageToR2 } from "./r2Storage.js";
import {
  buildRemoteWardrobeImageSourceKey,
  downloadWardrobeProductPageImage,
  extractOpenGraphImageUrl,
  fetchProductPageHtmlWithImpers,
  type ProductPageFetchResult,
  type ProductPageImageDownloadResult,
  type ProductPageUrlFetchResult,
} from "./wardrobeProductPageImport.js";
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
  buildCleanupProfile,
  buildDirectImageCleanup,
  buildPortraitImageBuffer,
  normalizeCleanupResult,
} from "./wardrobeUploadProcessingImages.js";

type DirectImageInput = {
  buffer: Buffer | Uint8Array;
  imageUrl: string;
  originalName: string;
};

type DirectImageFetchResult = Extract<
  ProductPageUrlFetchResult,
  { type: "image" }
>;

function isDirectImageFetchResult(
  result: ProductPageUrlFetchResult,
): result is DirectImageFetchResult {
  return "type" in result && result.type === "image";
}

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

function buildProductPageSource({
  email,
  image,
  imageUrl,
  productPageUrl,
}: {
  email: string;
  image: ProductPageImageDownloadResult;
  imageUrl: string;
  productPageUrl: string;
}): WardrobeUploadProcessingSource {
  return {
    imageUrl,
    kind: "product-page",
    productPageUrl,
    rawImageUrl: imageUrl,
    sourceImageKey: buildRemoteWardrobeImageSourceKey({ email, image }),
    sourceImageUrl: null,
  };
}

async function buildProductPageCleanup({
  email,
  image,
  imageLlm,
  imageUrl,
  source,
}: {
  email: string;
  image: ProductPageImageDownloadResult;
  imageLlm: string;
  imageUrl: string;
  source: WardrobeUploadProcessingSource;
}) {
  const cleanupResult = await cleanupUploadedWardrobeItemImage({
    email,
    ensurePortraitCanvas: true,
    imageUrl,
    sourceBuffer: image.buffer,
    sourceFilename: image.originalName,
    sourceKey: source.sourceImageKey,
    sourceMimeType: image.mimeType,
    getProfileImpl: async () => buildCleanupProfile(imageLlm),
  });
  return normalizeCleanupResult(cleanupResult);
}

async function analyzeProductPageImage({
  image,
  imageUrl,
  productPage,
}: {
  image: ProductPageImageDownloadResult;
  imageUrl: string;
  productPage: ProductPageFetchResult;
}) {
  return analyzeWardrobeProductPageImage({
    image: {
      buffer: image.buffer,
      filename: image.originalName,
      imageUrl,
      mimeType: image.mimeType,
    },
    imageUrl,
    productPageHtml: productPage.html,
    productPageUrl: productPage.url,
  });
}

async function processProductPageUrlItem({
  email,
  imageLlm,
  input,
  productPage,
  sendImpl,
}: {
  email: string;
  imageLlm: string;
  input: Extract<WardrobeUploadProcessingInput, { kind: "url" }>;
  productPage: ProductPageFetchResult;
  sendImpl?: WardrobeUploadProcessingSend;
}): Promise<WardrobeUploadProcessingResult> {
  let analysis = null;
  let cleanup = null;
  let source: WardrobeUploadProcessingSource | null = null;

  try {
    const imageUrl = extractOpenGraphImageUrl(
      productPage.html,
      productPage.url,
    );
    if (!imageUrl) {
      throw new Error("product_page_og_image_missing");
    }

    const image = await downloadWardrobeProductPageImage({ imageUrl });
    source = buildProductPageSource({
      email,
      image,
      imageUrl,
      productPageUrl: productPage.url,
    });
    sendProcessingEvent(sendImpl, {
      event: "source-uploaded",
      inputIndex: input.inputIndex,
      kind: "product-page",
      source,
    });

    analysis = await analyzeProductPageImage({ image, imageUrl, productPage });
    sendProcessingEvent(sendImpl, {
      event: "metadata-ready",
      inputIndex: input.inputIndex,
      kind: "product-page",
    });
    cleanup = await buildProductPageCleanup({
      email,
      image,
      imageLlm,
      imageUrl,
      source,
    });
    sendProcessingEvent(sendImpl, {
      event: "image-cleaned",
      inputIndex: input.inputIndex,
      kind: "product-page",
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
      kind: "product-page",
      message: result.message || undefined,
      source,
    });
    return result;
  }
}

async function processUrlUploadItem({
  email,
  imageLlm,
  input,
  sendImpl,
}: {
  email: string;
  imageLlm: string;
  input: Extract<WardrobeUploadProcessingInput, { kind: "url" }>;
  sendImpl?: WardrobeUploadProcessingSend;
}): Promise<WardrobeUploadProcessingResult> {
  try {
    sendProcessingEvent(sendImpl, {
      event: "item-started",
      inputIndex: input.inputIndex,
      kind: "url",
    });
    const productPage = await fetchProductPageHtmlWithImpers({
      url: input.url,
    });

    const result = isDirectImageFetchResult(productPage)
      ? await processDirectImageUrlItem({
          email,
          image: productPage.image,
          inputIndex: input.inputIndex,
          sendImpl,
        })
      : await processProductPageUrlItem({
          email,
          imageLlm,
          input,
          productPage,
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
