import { mkdirSync, writeFileSync } from "node:fs";
import { buildSystemPrompt } from "./llm.js";
import { getProcessMemoryUsage } from "./imagePipeline.js";
import { logInfo } from "../logger.js";
import type {
  CountByKey,
  ErrorWithCode,
  GeneratedOutfitSetLike,
  LogContextLike,
  LlmUsageLike,
  LlmUsageSummary,
  StoredWardrobePayloadLike,
  UserProfileLike,
  WardrobeUiItemLike
} from "./types.js";

const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);

export type RequestedWardrobeParams = Partial<{
  forceRefresh: boolean;
  formalityLevel: string;
  style: string;
  occasions: string[];
  season: string[];
  audience: string;
  color: string;
  pattern: string;
  locale: string;
}>;

export function getSqlRows<TRow>(result: TRow[] | { count: number }): TRow[] {
  return Array.isArray(result) ? result : [];
}

export function formatLogValue(value) {
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

export function formatLogPayload(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

export function getShortRequestId(logContext = null) {
  const capsuleRequestId = String(logContext?.capsuleRequestId || "").trim();
  if (!capsuleRequestId) {
    return "";
  }

  return capsuleRequestId.split("-")[0] || capsuleRequestId.slice(0, 8);
}

export function logWardrobeInfo(event, payload = {}, logContext = null) {
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

export function logWardrobeMemory(event, payload = {}, logContext = null) {
  logWardrobeInfo(event, {
    ...payload,
    ...getProcessMemoryUsage()
  }, logContext);
}

export function buildLastPromptArtifact(prompt, userProfile = null) {
  if (typeof prompt !== "string") {
    return "";
  }

  const systemPrompt = buildSystemPrompt(userProfile);
  return [
    systemPrompt ? `System:\n${systemPrompt}` : "",
    `User:\n${prompt}`
  ].filter(Boolean).join("\n\n");
}

export function saveLastPromptArtifacts(prompt, userProfile = null) {
  if (process.env.NODE_ENV !== "development" || typeof prompt !== "string") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });
  writeFileSync(
    new URL("last_prompt.txt", LAST_PROMPT_DIR_URL),
    buildLastPromptArtifact(prompt, userProfile),
    "utf8"
  );
}

export function countItemsByKey(items: WardrobeUiItemLike[] = [], key = "category"): CountByKey {
  return items.reduce<CountByKey>((result, item) => {
    const value = String(item?.[key] || "").trim();
    if (!value) {
      return result;
    }

    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

export function getRequestedWardrobeParams(
  userProfile: UserProfileLike | null = null,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): RequestedWardrobeParams {
  const params: RequestedWardrobeParams = {};

  if (forceRefresh) {
    params.forceRefresh = true;
  }

  addRequestedStringParams(params, userProfile, ["formalityLevel", "style", "audience", "color", "pattern", "locale"]);
  addRequestedArrayParams(params, userProfile, ["occasions", "season"]);
  return params;
}

function addRequestedStringParams(
  params: RequestedWardrobeParams,
  userProfile: UserProfileLike | null,
  keys: ReadonlyArray<keyof RequestedWardrobeParams>
): void {
  for (const key of keys) {
    const value = typeof userProfile?.[key] === "string" ? userProfile[key].trim() : "";
    if (value) {
      params[key] = value as never;
    }
  }
}

function addRequestedArrayParams(
  params: RequestedWardrobeParams,
  userProfile: UserProfileLike | null,
  keys: ReadonlyArray<"occasions" | "season">
): void {
  for (const key of keys) {
    const values = Array.isArray(userProfile?.[key])
      ? userProfile[key].filter((value) => typeof value === "string" && value.trim().length > 0)
      : [];
    if (values.length > 0) {
      params[key] = values;
    }
  }
}

export function getRequiredCapsule<TCapsule>(capsuleId: string, capsule: TCapsule | null): TCapsule {
  if (!capsuleId) {
    const error = new Error("invalid_payload") as ErrorWithCode;
    error.code = "invalid_payload";
    throw error;
  }

  if (!capsule) {
    const error = new Error("not_found") as ErrorWithCode;
    error.code = "not_found";
    throw error;
  }

  return capsule;
}

export function extractLlmUsage(usage: LlmUsageLike | null = null): LlmUsageSummary {
  if (!usage || typeof usage !== "object") {
    return {};
  }

  const result: LlmUsageSummary = {};

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

export function buildErrorLogContext(logContext: LogContextLike | null = null) {
  if (!logContext?.capsuleRequestId) {
    return null;
  }

  return {
    capsuleRequestId: logContext.capsuleRequestId
  };
}

export function buildWardrobePayload({
  items,
  outfitSets = [],
  rawSelectionText = null,
  swimwearReasoning = null,
  swimwearRawSelectionText = null
}: {
  items: WardrobeUiItemLike[];
  outfitSets?: GeneratedOutfitSetLike[];
  rawSelectionText?: string | null;
  swimwearReasoning?: string | null;
  swimwearRawSelectionText?: string | null;
}): StoredWardrobePayloadLike {
  return {
    items,
    outfitSets: outfitSets as unknown as StoredWardrobePayloadLike["outfitSets"],
    rawSelectionText,
    swimwearReasoning,
    swimwearRawSelectionText
  };
}
