import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type WardrobeUploadProcessingChildMessage,
  type WardrobeUploadProcessingInput,
  type WardrobeUploadProcessingPayload,
  type WardrobeUploadProcessingResult,
  getWardrobeUploadProcessingErrorMessage,
} from "./wardrobeUploadProcessingCore.js";
import { processFileUploadItem } from "./wardrobeUploadProcessingFileItem.js";
import { normalizeImageBuffer } from "./wardrobeUploadProcessingImages.js";
import { processUrlUploadItem } from "./wardrobeUploadProcessingUrlItem.js";

function getChildPayload(message: WardrobeUploadProcessingPayload) {
  const email = String(message?.email || "").trim();
  const imageLlm = String(message?.imageLlm || "").trim();
  const items = Array.isArray(message?.items) ? message.items : [];
  if (!email) {
    throw new Error("wardrobe_upload_processing_email_missing");
  }
  if (!imageLlm) {
    throw new Error("wardrobe_upload_processing_image_llm_missing");
  }
  if (items.length === 0) {
    throw new Error("wardrobe_upload_processing_items_missing");
  }

  return { email, imageLlm, items };
}

async function processUploadItem({
  email,
  imageLlm,
  item,
  sendImpl,
}: {
  email: string;
  imageLlm: string;
  item: WardrobeUploadProcessingInput;
  sendImpl?: (message: unknown, callback?: () => void) => unknown;
}) {
  return item.kind === "file"
    ? processFileUploadItem({
        email,
        imageLlm,
        input: item,
        sendImpl,
      })
    : processUrlUploadItem({
        email,
        imageLlm,
        input: item,
        sendImpl,
      });
}

async function processWardrobeUploadItems({
  email,
  imageLlm,
  items,
  sendImpl = process.send?.bind(process),
}: WardrobeUploadProcessingPayload & {
  sendImpl?: (message: unknown, callback?: () => void) => unknown;
}) {
  const results: WardrobeUploadProcessingResult[] = [];

  for (const item of items) {
    results.push(
      await processUploadItem({
        email,
        imageLlm,
        item,
        sendImpl,
      }),
    );
  }

  return results;
}

function createWardrobeUploadProcessingChildRuntime({
  processWardrobeUploadItemsImpl = processWardrobeUploadItems,
  sendImpl = process.send?.bind(process),
  disconnectImpl = process.disconnect?.bind(process),
  exitImpl = (code: number) => {
    process.exit(code);
  },
}: {
  disconnectImpl?: (() => unknown) | undefined;
  exitImpl?: (code: number) => void;
  processWardrobeUploadItemsImpl?: typeof processWardrobeUploadItems;
  sendImpl?: ((message: unknown, callback?: () => void) => unknown) | undefined;
} = {}) {
  let handled = false;

  function sendFinalMessage(message: WardrobeUploadProcessingChildMessage) {
    if (!sendImpl) {
      exitImpl(message.type === "result" && message.ok ? 0 : 1);
      return;
    }

    sendImpl(message, () => {
      disconnectImpl?.();
      exitImpl(message.type === "result" && message.ok ? 0 : 1);
    });
  }

  async function handleMessage(message: WardrobeUploadProcessingPayload) {
    if (handled) {
      return;
    }
    handled = true;

    try {
      const payload = getChildPayload(message);
      const results = await processWardrobeUploadItemsImpl({
        ...payload,
        sendImpl,
      });
      sendFinalMessage({ ok: true, results, type: "result" });
    } catch (error) {
      sendFinalMessage({
        ok: false,
        type: "result",
        ...getWardrobeUploadProcessingErrorMessage(error),
      });
    }
  }

  return { handleMessage, sendFinalMessage };
}

const wardrobeUploadProcessingChildRuntime =
  createWardrobeUploadProcessingChildRuntime();

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.once("message", (message) => {
    void wardrobeUploadProcessingChildRuntime.handleMessage(
      message as WardrobeUploadProcessingPayload,
    );
  });
}

export {
  createWardrobeUploadProcessingChildRuntime,
  normalizeImageBuffer,
  processWardrobeUploadItems,
};
