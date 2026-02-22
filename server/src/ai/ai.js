import { getLinkPreview } from "link-preview-js";
import { readFileSync } from "node:fs";
import { getActiveAiPromptConfig } from "../db.js";
import { getProfile, updateProfileWardrobeItems } from "../profileStore.js";
import { callOpenAiWardrobe } from "./openai.js";
import { callGeminiWardrobe } from "./gemini.js";
import en from "../../../shared/i18n/en.js";

const DEFAULT_AI_PROVIDER = "openai";
const AI_MODELS = {
  openai: "gpt-5.2",
  gemini: "gemini-2.5-flash"
};
const AI_CONFIG_CACHE_TTL_MS = Number(process.env.AI_CONFIG_CACHE_TTL_MS) || 5 * 60 * 1000;
const PROMPT_TEMPLATE = readFileSync(new URL("../templates/prompt.txt", import.meta.url), "utf8").trim();
const PROMPT_CONFIG_NAME = process.env.PROMPT_CONFIG_NAME || "wardrobe_default";
const CATEGORIES = {
  bottom: 2,
  top: 2,
  outerwear: 1,
  shoes: 2,
  belt: 1,
  bag: 2
};
const DEFAULT_BRAND_URLS = [
  "https://www.arket.com/en-nl/",
  "https://www.stories.com/en-nl/",
  "https://www.cos.com/en-nl/"
];
const SUPPORTED_AI_PROVIDERS = new Set(["openai", "gemini"]);

let cachedAiConfig = null;
let cachedAiConfigExpiresAt = 0;

function normalizeCategories(rawCategories) {
  if (!rawCategories || typeof rawCategories !== "object" || Array.isArray(rawCategories)) {
    return null;
  }

  const validated = {};
  let hasPositiveCount = false;
  for (const category of Object.keys(rawCategories)) {
    const value = rawCategories[category];
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }
    validated[category] = value;
    if (value > 0) {
      hasPositiveCount = true;
    }
  }

  if (!hasPositiveCount) {
    return null;
  }

  return Object.keys(validated).length > 0 ? validated : null;
}

function normalizeBrandUrls(rawBrandUrls) {
  if (!Array.isArray(rawBrandUrls) || rawBrandUrls.length === 0) {
    return null;
  }

  const normalized = [];
  for (const url of rawBrandUrls) {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        return null;
      }
      normalized.push(url);
    } catch {
      return null;
    }
  }

  return normalized;
}

function formatCategoryRequirements(counts) {
  const defaultOrder = Object.keys(CATEGORIES);
  const categories = [
    ...defaultOrder.filter((category) => Object.prototype.hasOwnProperty.call(counts, category)),
    ...Object.keys(counts).filter((category) => !defaultOrder.includes(category))
  ];

  return categories.filter((category) => counts[category] > 0).map((category) => `${counts[category]} ${category}`).join(", ");
}

function localizeProfileValues(values, dictionary) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Not specified";
  }

  const localized = values
    .map((value) => dictionary[value] || value)
    .filter((value) => typeof value === "string" && value.trim().length > 0);
  if (localized.length === 0) {
    return "Not specified";
  }

  return localized.join(", ");
}

function getWardrobePrompt(promptTemplate, counts, brandUrls, userProfile = null) {
  const requirementText = formatCategoryRequirements(counts);
  const brandUrlsText = brandUrls.map((url) => `- ${url}`).join("\n");
  const stylePreferencesText = localizeProfileValues(userProfile?.stylePreferences, en.options.styles);
  const wardrobeOccasionsText = localizeProfileValues(userProfile?.wardrobeOccasions, en.options.occasions);

  return promptTemplate
    .replace("{{CATEGORY_REQUIREMENTS}}", requirementText)
    .replace("{{BRAND_URLS}}", brandUrlsText)
    .replace("{{STYLE_PREFERENCES}}", stylePreferencesText)
    .replace("{{WARDROBE_OCCASIONS}}", wardrobeOccasionsText);
}

async function getWardrobeAiConfig() {
  const now = Date.now();
  if (cachedAiConfig && now < cachedAiConfigExpiresAt) {
    return cachedAiConfig;
  }

  const config = await getActiveAiPromptConfig(PROMPT_CONFIG_NAME);
  let fallbackReason = "";
  let resolvedConfig = null;

  if (!config) {
    fallbackReason = "No active ai_prompt_configs row found";
  } else {
    const categories = normalizeCategories(config.categories);
    const brandUrls = normalizeBrandUrls(config.brandUrls);
    const promptTemplate =
      typeof config.promptTemplate === "string" && config.promptTemplate.trim() ? config.promptTemplate : null;
    const ai =
      typeof config.ai === "string" && SUPPORTED_AI_PROVIDERS.has(config.ai.trim())
        ? config.ai.trim()
        : DEFAULT_AI_PROVIDER;

    if (categories && brandUrls && promptTemplate) {
      resolvedConfig = {
        ai,
        model:
          typeof config.model === "string" && config.model.trim()
            ? config.model.trim()
            : AI_MODELS[ai] || AI_MODELS[DEFAULT_AI_PROVIDER],
        promptTemplate,
        categories,
        brandUrls
      };
    } else {
      fallbackReason = "Invalid ai_prompt_configs row";
    }
  }

  if (!resolvedConfig) {
    console.error(`[wardrobe-ai] ${fallbackReason}, fallback to local defaults`);
    resolvedConfig = {
      ai: DEFAULT_AI_PROVIDER,
      model: AI_MODELS[DEFAULT_AI_PROVIDER],
      promptTemplate: PROMPT_TEMPLATE,
      categories: CATEGORIES,
      brandUrls: DEFAULT_BRAND_URLS
    };
  }

  cachedAiConfig = resolvedConfig;
  cachedAiConfigExpiresAt = Date.now() + AI_CONFIG_CACHE_TTL_MS;
  return resolvedConfig;
}

function isValidWardrobeItem(item, allowedCategories, allowedUrlPrefixes) {
  if (!item || typeof item !== "object") {
    return false;
  }
  if (!allowedCategories.has(item.category)) {
    return false;
  }
  if (typeof item.link !== "string" || item.link.trim().length === 0) {
    return false;
  }
  const normalizedLink = item.link.trim();
  if (!allowedUrlPrefixes.some((prefix) => normalizedLink.startsWith(prefix))) {
    return false;
  }

  try {
    const url = new URL(normalizedLink);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getAllowedDomains(brandUrls) {
  const domains = new Set();
  for (const url of brandUrls || []) {
    try {
      const hostname = new URL(url).hostname.trim().toLowerCase();
      if (hostname) {
        domains.add(hostname);
      }
    } catch {
      // ignore invalid urls, validation is handled elsewhere
    }
  }
  return Array.from(domains);
}

async function callWardrobeAi(userProfile = null) {
  const aiConfig = await getWardrobeAiConfig();
  const prompt = getWardrobePrompt(aiConfig.promptTemplate, aiConfig.categories, aiConfig.brandUrls, userProfile);
  const allowedCategories = new Set(Object.keys(aiConfig.categories));
  const allowedDomains = getAllowedDomains(aiConfig.brandUrls);

  if (allowedDomains.length === 0) {
    throw new Error("No allowed domains configured for web_search");
  }

  let items;
  if (aiConfig.ai === "openai") {
    items = await callOpenAiWardrobe({
      model: aiConfig.model,
      prompt,
      allowedCategories,
      allowedDomains
    });
  } else if (aiConfig.ai === "gemini") {
    items = await callGeminiWardrobe({
      model: aiConfig.model,
      prompt,
      allowedCategories,
      allowedDomains
    });
  } else {
    throw new Error(`Unsupported AI provider: ${aiConfig.ai}`);
  }

  return items.filter((item) => isValidWardrobeItem(item, allowedCategories, aiConfig.brandUrls));
}

async function prefetchLinksData(items) {
  const processed = await Promise.all(
    items.map(async (item) => {
      if (!item.link) {
        return null;
      }
      try {
        const data = await getLinkPreview(item.link, {
          imagesPropertyType: "og",
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          },
          followRedirects: "manual",
          handleRedirects: (baseURL, forwardedURL) => {
            const urlObj = new URL(baseURL);
            const forwardedURLObj = new URL(forwardedURL);
            if (
              forwardedURLObj.hostname === urlObj.hostname ||
              forwardedURLObj.hostname === "www." + urlObj.hostname ||
              "www." + forwardedURLObj.hostname === urlObj.hostname
            ) {
              return true;
            }
            return false;
          },
          timeout: 3000
        });
        if (
          !data ||
          typeof data !== "object" ||
          Object.keys(data).length === 0 ||
          !data.title ||
          data.title.indexOf("404") !== -1 ||
          !data.images ||
          data.images.length === 0
        ) {
          return null;
        }
        return { ...item, data };
      } catch (error) {
        console.log(error);
        return null;
      }
    })
  );
  return processed.filter(Boolean);
}

async function getWardrobeItems(req, res) {
  try {
    const profile = await getProfile(req.user.email);
    if (profile && Array.isArray(profile.wardrobeItems) && profile.wardrobeItems.length > 0) {
      return res.json({ ok: true, items: profile.wardrobeItems });
    }

    let items = await callWardrobeAi(profile);
    let processedItems = await prefetchLinksData(items);

    if (processedItems.length === 0) {
      items = await callWardrobeAi(profile);
      processedItems = await prefetchLinksData(items);
    }

    if (processedItems.length === 0) {
      throw new Error("AI response has no valid wardrobe items after retry");
    }

    if (profile) {
      await updateProfileWardrobeItems(req.user.email, processedItems);
    }

    return res.json({ ok: true, items: processedItems });
  } catch (error) {
    console.error("[wardrobe-ai]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
}

export { getWardrobeItems };
