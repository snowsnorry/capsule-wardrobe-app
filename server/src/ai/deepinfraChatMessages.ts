import { logWarn } from "../logger.js";
import { buildImageDataUrl } from "./openai.js";
import type { ImageAssetLike } from "./types.js";

type DeepInfraChatMessageContent =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

function buildChatMessages(
  user: string,
  images: ImageAssetLike[] = [],
): DeepInfraChatMessageContent[] {
  const content: DeepInfraChatMessageContent[] = [];
  const userText = String(user || "").trim();

  for (const image of images) {
    const imageUrl = buildImageDataUrl(image);
    if (!imageUrl) {
      logWarn(
        "[deepinfra][image-skipped]",
        JSON.stringify({
          category: image?.category ?? null,
          filename: image?.filename ?? null,
          reason: "missing_buffer",
        }),
      );
      continue;
    }

    content.push({
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    });
  }

  if (userText) {
    content.push({
      type: "text",
      text: userText,
    });
  }

  return content.length > 0 ? content : [{ type: "text", text: "" }];
}

export { buildChatMessages };
export type { DeepInfraChatMessageContent };
