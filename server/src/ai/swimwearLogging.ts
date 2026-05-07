import type { LlmUsageLike } from "./types.js";
import { logInfo } from "../logger.js";

export function formatLogValue(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function formatLogPayload(payload: Record<string, unknown> = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

export function getShortRequestId(
  logContext: { capsuleRequestId?: string | null } | null = null,
) {
  const capsuleRequestId = String(logContext?.capsuleRequestId || "").trim();
  if (!capsuleRequestId) {
    return "";
  }

  return capsuleRequestId.split("-")[0] || capsuleRequestId.slice(0, 8);
}

export function logWardrobeInfo(
  event: string,
  payload: Record<string, unknown> = {},
  logContext: { capsuleRequestId?: string | null } | null = null,
) {
  const shortRequestId = getShortRequestId(logContext);
  const prefix = shortRequestId
    ? `[${shortRequestId}][wardrobe-ai][${event}]`
    : `[wardrobe-ai][${event}]`;
  const message = formatLogPayload(payload);

  if (message) {
    logInfo(`${prefix} ${message}`);
    return;
  }

  logInfo(prefix);
}

export function countItemsByKey(
  items: Array<Record<string, unknown>> = [],
  key = "category",
) {
  return items.reduce<Record<string, number>>((result, item) => {
    const value = String(item?.[key] || "").trim();
    if (!value) {
      return result;
    }

    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

export function extractLlmUsage(usage: LlmUsageLike | null = null) {
  if (!usage) {
    return {};
  }

  const result: Record<string, number> = {};

  if (Number.isFinite(usage.input_tokens)) {
    result.inputTokens = usage.input_tokens;
  }

  if (Number.isFinite(usage.output_tokens)) {
    result.outputTokens = usage.output_tokens;
  }

  if (Number.isFinite(usage.total_tokens)) {
    result.totalTokens = usage.total_tokens;
  }

  const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens;
  if (Number.isFinite(reasoningTokens)) {
    result.reasoningTokens = reasoningTokens;
  }

  return result;
}
