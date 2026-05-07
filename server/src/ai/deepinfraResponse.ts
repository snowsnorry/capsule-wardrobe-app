import type { ParsedGenerationError } from "./types.js";

function estimateJsonByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
}

function parseDeepInfraJsonResponse(content: string) {
  let normalizedContent = content;
  if (normalizedContent) {
    normalizedContent = normalizedContent
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "");
  }

  try {
    return JSON.parse(normalizedContent);
  } catch (error) {
    const parseError = new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}\nResponse content: ${normalizedContent}`,
    ) as ParsedGenerationError;
    parseError.rawSelectionText =
      typeof content === "string" && content.trim().length > 0
        ? content.trim()
        : null;
    throw parseError;
  }
}

function extractResponseText(
  response: {
    choices?: Array<{
      message?: { content?: string | Array<string | { text?: string | null }> };
    }>;
  } | null = null,
) {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "{}";
}

async function collectStreamText(stream: AsyncIterable<unknown>) {
  let content = "";

  for await (const chunk of stream) {
    content += extractChunkText(chunk);
  }

  return content;
}

function extractChunkText(
  chunk: {
    choices?: Array<{
      delta?: { content?: string | Array<string | { text?: string | null }> };
    }>;
  } | null = null,
) {
  const delta = chunk?.choices?.[0]?.delta;
  const content = delta?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

export {
  collectStreamText,
  estimateJsonByteLength,
  extractChunkText,
  extractResponseText,
  parseDeepInfraJsonResponse,
};
