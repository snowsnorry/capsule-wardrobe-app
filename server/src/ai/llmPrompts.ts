import { readFileSync } from "node:fs";
import { getCapsuleCategories } from "./categories.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import type { UserProfileLike } from "./types.js";
import {
  buildCapsuleSchema,
  buildCustomJsonObjectFormat,
  buildJsonObjectFormat,
  buildSwimwearSchema,
} from "./llmJsonFormats.js";
import {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  getProfileLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llmProviders.js";
const CAPSULE_GENERATION_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_capsule_generation.yaml", import.meta.url),
);
const SYSTEM_PROMPT_TEMPLATE = getPromptTemplateContent(
  CAPSULE_GENERATION_PROMPT_TEMPLATE,
  "system",
);
const SYSTEM_PROMPT_PARTS = JSON.parse(
  readFileSync(
    new URL(
      "../templates/prompt_capsule_generation_parts.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Record<string, unknown>;

type BuildSystemPromptOptions = {
  template?: string | null;
  categories?: Record<string, number> | null;
};

function splitSystemAndUserPrompt(prompt: string) {
  const source = String(prompt || "");
  const systemMarker = "System:";
  const userMarker = "User:";
  const systemStart = source.indexOf(systemMarker);
  const userStart = source.indexOf(userMarker);

  if (systemStart === -1 || userStart === -1 || userStart < systemStart) {
    return {
      system: "",
      user: source.trim(),
    };
  }

  return {
    system: source.slice(systemStart + systemMarker.length, userStart).trim(),
    user: source.slice(userStart + userMarker.length).trim(),
  };
}

function normalizeSystemPromptKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSystemPromptAudience(value: unknown) {
  const normalized = normalizeSystemPromptKey(value);
  if (normalized === "woman" || normalized === "man") {
    return normalized;
  }
  return "not important";
}

function normalizeSystemPromptSectionContent(content: unknown) {
  if (Array.isArray(content)) {
    return content
      .filter((line) => typeof line === "string" && line.trim().length > 0)
      .join("\n")
      .trim();
  }

  return typeof content === "string" ? content.trim() : "";
}

function normalizeSystemPromptSeasonList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((season) => normalizeSystemPromptKey(season))
      .filter(Boolean);
  }

  const normalized = normalizeSystemPromptKey(value);
  return normalized ? [normalized] : [];
}

function renderSeasonalityLogicContent(
  entry: unknown,
  userProfile: UserProfileLike | null = null,
) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const normalizedEntry = entry as Record<string, unknown>;

  const seasons = new Set(normalizeSystemPromptSeasonList(userProfile?.season));
  const lines = [];

  if (seasons.has("summer") && typeof normalizedEntry.summer === "string") {
    lines.push(normalizedEntry.summer);
  }

  if (
    (seasons.has("spring") || seasons.has("autumn")) &&
    typeof normalizedEntry.spring_autumn === "string"
  ) {
    lines.push(normalizedEntry.spring_autumn);
  }

  if (seasons.has("winter") && typeof normalizedEntry.winter === "string") {
    lines.push(normalizedEntry.winter);
  }

  return lines.join("\n").trim();
}

function renderStyleLibraryContent(
  entry: unknown,
  userProfile: UserProfileLike | null = null,
) {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const normalizedEntry = entry as Record<string, unknown>;
  const template =
    typeof normalizedEntry.template === "string"
      ? normalizedEntry.template
      : "";
  if (!template) {
    return "";
  }

  const replacements = buildStyleLibraryReplacements(
    normalizedEntry,
    userProfile,
  );

  let content = template;
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content.replace(/\n{3,}/g, "\n\n").trim();
}

function getStringConfigValue(config: unknown, key: string) {
  return typeof config === "object" &&
    config &&
    typeof (config as Record<string, unknown>)[key] === "string"
    ? (config as Record<string, string>)[key]
    : "";
}

function buildStyleLibraryReplacements(
  normalizedEntry: Record<string, unknown>,
  userProfile: UserProfileLike | null = null,
) {
  const occasions = Array.isArray(userProfile?.occasions)
    ? userProfile.occasions
    : [];

  return {
    audience: getStringConfigValue(
      normalizedEntry.audience,
      normalizeSystemPromptAudience(userProfile?.audience),
    ),
    formality_level: getStringConfigValue(
      normalizedEntry.formality_level,
      normalizeSystemPromptKey(userProfile?.formalityLevel),
    ),
    occasions: occasions
      .map((occasion) => normalizeSystemPromptKey(occasion))
      .map((occasionKey) =>
        getStringConfigValue(normalizedEntry.occasions, occasionKey),
      )
      .filter((value) => value.trim().length > 0)
      .join("\n"),
  };
}

function renderSystemPromptSection(
  title: string,
  content: unknown,
  intro = "",
) {
  const normalizedContent = normalizeSystemPromptSectionContent(content);
  if (!normalizedContent) {
    return "";
  }

  return [title, intro.trim(), normalizedContent].filter(Boolean).join("\n\n");
}

function buildSystemPrompt(
  userProfile: UserProfileLike | null = null,
  options: BuildSystemPromptOptions = {},
) {
  const styleKey = normalizeSystemPromptKey(userProfile?.style);
  const accentColorKey = normalizeSystemPromptKey(userProfile?.color);
  const audienceKey = normalizeSystemPromptAudience(userProfile?.audience);
  const formalityLevelKey = normalizeSystemPromptKey(
    userProfile?.formalityLevel,
  );
  const replacements = buildSystemPromptReplacements({
    userProfile,
    styleKey,
    accentColorKey,
    audienceKey,
    formalityLevelKey,
    categories: resolveSystemPromptCategories(userProfile, options),
  });

  const prompt =
    typeof options.template === "string"
      ? options.template
      : SYSTEM_PROMPT_TEMPLATE;
  return renderPromptTemplateContent(prompt, replacements, "system prompt");
}

function resolveSystemPromptCategories(
  userProfile: UserProfileLike | null,
  options: BuildSystemPromptOptions,
) {
  return options.categories && typeof options.categories === "object"
    ? options.categories
    : getCapsuleCategories(userProfile);
}

function buildSystemPromptReplacements({
  userProfile,
  styleKey,
  accentColorKey,
  audienceKey,
  formalityLevelKey,
  categories,
}: {
  userProfile: UserProfileLike | null;
  styleKey: string;
  accentColorKey: string;
  audienceKey: string;
  formalityLevelKey: string;
  categories: Record<string, number>;
}) {
  return {
    audience_logic_block: normalizeSystemPromptSectionContent(
      SYSTEM_PROMPT_PARTS.audience_logic?.[audienceKey],
    ),
    formality_logic_block: normalizeSystemPromptSectionContent(
      SYSTEM_PROMPT_PARTS.formality_logic?.[formalityLevelKey],
    ),
    seasonality_logic_block: renderSeasonalityLogicContent(
      SYSTEM_PROMPT_PARTS.seasonality_logic,
      userProfile,
    ),
    style_library_block: renderSystemPromptSection(
      "STYLE LIBRARY",
      renderStyleLibraryContent(
        SYSTEM_PROMPT_PARTS.style_library?.[styleKey],
        userProfile,
      ),
    ),
    style_palette_block: renderSystemPromptSection(
      "PALETTE REFERENCE BY STYLE",
      SYSTEM_PROMPT_PARTS.palette_by_style?.[styleKey],
      "Use these as preferred defaults when no better user constraint overrides them.",
    ),
    accent_color_palette_block: renderSystemPromptSection(
      "PALETTE REFERENCE BY ACCENT COLOR",
      SYSTEM_PROMPT_PARTS.palette_by_accent_color?.[accentColorKey],
      "If the user specifies an accent color, you may use these defaults:",
    ),
    categories_schema: JSON.stringify(buildCapsuleSchema(categories), null, 2),
  };
}

export {
  CLAUDE_ALLOWED_MODELS,
  GEMINI_PROFILE_LLM,
  buildCapsuleSchema,
  buildCustomJsonObjectFormat,
  buildJsonObjectFormat,
  buildSwimwearSchema,
  buildSystemPrompt,
  getProfileLlm,
  isNoLlmProfileEnabled,
  renderStyleLibraryContent,
  resolveLlmProvider,
  splitSystemAndUserPrompt,
};
