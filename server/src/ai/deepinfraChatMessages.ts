import { logWarn } from "../logger.js";
import { getSafeHttpUrl } from "../../../shared/urlSecurity.js";
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
    const imageUrl = buildDeepInfraImageUrl(image);
    if (!imageUrl) {
      logWarn("ai.deepinfra.image.skipped", {
        category: image?.category ?? null,
        filename: image?.filename ?? null,
        reason: "missing_buffer_or_url",
      });
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

function buildDeepInfraImageUrl(image: ImageAssetLike): string {
  return buildImageDataUrl(image) || getSafeHttpUrl(image?.imageUrl);
}

export { buildChatMessages };
export type { DeepInfraChatMessageContent };
