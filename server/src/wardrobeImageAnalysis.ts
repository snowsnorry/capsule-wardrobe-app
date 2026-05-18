import {
  getPromptTemplateContent,
  loadPromptTemplate,
} from "./ai/promptTemplates.js";
import { generateJsonWithLlm } from "./ai/deepinfra.js";
import { logInfo } from "./logger.js";

const IMAGE_ANALYSIS_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("./templates/prompt_image_analysis.yaml", import.meta.url),
);
const IMAGE_ANALYSIS_SYSTEM_PROMPT = getPromptTemplateContent(
  IMAGE_ANALYSIS_PROMPT_TEMPLATE,
  "system",
);
const IMAGE_ANALYSIS_USER_PROMPT = getPromptTemplateContent(
  IMAGE_ANALYSIS_PROMPT_TEMPLATE,
  "user",
);
const IMAGE_ANALYSIS_MODEL = "google/gemma-4-31B-it";

type WardrobeImageAnalysisMetadata = {
  name: string | null;
  description: string | null;
  brand: string | null;
  audience: string | null;
  category: string | null;
  season: string[];
  formality_level: string[];
  style: string[];
  occasions: string[];
  color_base: string[];
  is_neutral: boolean | null;
  pattern: string | null;
  finish: string | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closure_type: string[];
};

type WardrobeImageAnalysisResult = {
  hasMetadata: boolean;
  metadata: WardrobeImageAnalysisMetadata;
  rawResponse: string;
};

const STRING_FIELDS = [
  "name",
  "description",
  "brand",
  "audience",
  "category",
  "pattern",
  "finish",
  "composition",
  "silhouette",
  "fit",
] as const;
const ARRAY_FIELDS = [
  "season",
  "formality_level",
  "style",
  "occasions",
  "color_base",
  "closure_type",
] as const;
const NEUTRAL_COLOR_NAMES = new Set([
  "black",
  "white",
  "grey",
  "beige",
  "brown",
  "light blue",
  "navy",
  "denim",
  "khaki",
]);

function normalizeStringValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join(", ");
    return joined || null;
  }

  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function normalizeWardrobeImageAnalysisMetadata(
  value: unknown,
): WardrobeImageAnalysisMetadata {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const metadata = {} as WardrobeImageAnalysisMetadata;

  for (const field of STRING_FIELDS) {
    metadata[field] = normalizeStringValue(source[field]);
  }

  for (const field of ARRAY_FIELDS) {
    metadata[field] = normalizeStringArray(source[field]);
  }
  metadata.is_neutral = null;

  return metadata;
}

function hasWardrobeImageAnalysisMetadata(
  metadata: WardrobeImageAnalysisMetadata,
) {
  return Object.entries(metadata).some(([key, value]) => {
    if (key === "is_neutral") {
      return false;
    }

    return Array.isArray(value) ? value.length > 0 : value !== null;
  });
}

function hasRequiredUploadedWardrobeMetadata(
  metadata: WardrobeImageAnalysisMetadata | null | undefined,
) {
  return (
    Boolean(String(metadata?.name || "").trim()) &&
    Boolean(String(metadata?.audience || "").trim()) &&
    Boolean(String(metadata?.category || "").trim()) &&
    Array.isArray(metadata?.season) &&
    metadata.season.some((season) => String(season || "").trim())
  );
}

function calculateWardrobeImageIsNeutral(
  metadata: Partial<Pick<WardrobeImageAnalysisMetadata, "color_base">> & {
    colorBase?: string[] | null;
    isNeutral?: boolean | null;
  },
) {
  const colors = Array.isArray(metadata.colorBase)
    ? metadata.colorBase
    : Array.isArray(metadata.color_base)
      ? metadata.color_base
      : [];
  return (
    colors.length > 0 &&
    colors.every((color) => NEUTRAL_COLOR_NAMES.has(color.trim().toLowerCase()))
  );
}

function buildWardrobeImageAnalysisPrompt() {
  return [
    `System: ${IMAGE_ANALYSIS_SYSTEM_PROMPT}`,
    `User: ${IMAGE_ANALYSIS_USER_PROMPT}`,
  ].join("\n\n");
}

function stringifyRawLlmResponse(response: unknown, json: unknown) {
  const outputText =
    response && typeof response === "object"
      ? (response as { output_text?: unknown }).output_text
      : null;
  if (typeof outputText === "string") {
    return outputText;
  }

  try {
    return JSON.stringify(json);
  } catch {
    return String(json);
  }
}

async function analyzeWardrobeImageUrl({
  imageUrl,
  generateJsonWithLlmImpl = generateJsonWithLlm,
  logInfoImpl = logInfo,
}: {
  imageUrl: string;
  generateJsonWithLlmImpl?: typeof generateJsonWithLlm;
  logInfoImpl?: (...values: unknown[]) => void;
}): Promise<WardrobeImageAnalysisResult> {
  const { response, json } = await generateJsonWithLlmImpl(
    buildWardrobeImageAnalysisPrompt(),
    {
      images: [{ imageUrl }],
      systemPrompt: " ",
      userProfile: { llm: `deepinfra:${IMAGE_ANALYSIS_MODEL}` },
    },
  );
  const rawResponse = stringifyRawLlmResponse(response, json);
  logInfoImpl(
    "[wardrobe-image-analysis][llm-response]",
    JSON.stringify({ imageUrl, response: rawResponse }),
  );
  const metadata = normalizeWardrobeImageAnalysisMetadata(json);
  const hasMetadata = hasWardrobeImageAnalysisMetadata(metadata);
  metadata.is_neutral = hasMetadata
    ? calculateWardrobeImageIsNeutral(metadata)
    : null;

  return {
    hasMetadata,
    metadata,
    rawResponse,
  };
}

export {
  analyzeWardrobeImageUrl,
  buildWardrobeImageAnalysisPrompt,
  calculateWardrobeImageIsNeutral,
  hasRequiredUploadedWardrobeMetadata,
  hasWardrobeImageAnalysisMetadata,
  normalizeWardrobeImageAnalysisMetadata,
};
export type { WardrobeImageAnalysisMetadata };
