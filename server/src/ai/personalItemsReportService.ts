import { logError } from "../logger.js";
import { extractLlmUsage, logWardrobeInfo } from "./aiCommon.js";
import {
  buildPersonalItemsReportError,
  isPersonalItemsReportDomainError,
} from "./personalItemsReportErrors.js";
import {
  PERSONAL_ITEMS_REPORT_SYSTEM_PROMPT,
  buildPersonalItemsReportCollage,
  renderPersonalItemsReportPrompt,
  toPersonalItemsReportItem,
} from "./personalItemsReportPrompt.js";
import { buildPersonalItemsReportFormat } from "./personalItemsReportSchema.js";
import { applyComputedPersonalItemsVerdictScore } from "./personalItemsReportScoring.js";
import {
  createPersonalItemsReportServiceDeps,
  type PersonalItemsReportJsonGenerator,
  type PersonalItemsReportServiceDeps,
  type PersonalItemsReportServiceDepsOverrides,
} from "./personalItemsReportServiceDeps.js";
import type {
  PersonalItemsReport,
  PersonalItemsReportItem,
} from "./personalItemsReportTypes.js";
import { parsePersonalItemsReportLlmOutput } from "./personalItemsReportValidation.js";

const PERSONAL_ITEMS_REPORT_SCHEMA_VERSION = 1;

type PersonalItemsReportContext = {
  generateJsonWithLlm: PersonalItemsReportJsonGenerator;
  personalItemUrls: string[];
  profile: unknown;
  reportItems: PersonalItemsReportItem[];
  sourceItems: Record<string, unknown>[];
};

type PersonalItemsReportGenerationResult = {
  generatedAt: string | Date;
  personalItemUrls: string[];
  report: PersonalItemsReport;
};

function getStringField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getPersonalItemUrls(items: Record<string, unknown>[]) {
  return uniqueSorted(
    items.map((item) => getStringField(item, "url")).filter(Boolean),
  );
}

function assertCompleteUrlSnapshot(items: Record<string, unknown>[]) {
  const urls = getPersonalItemUrls(items);
  if (urls.length !== items.length) {
    throw buildPersonalItemsReportError("invalid_payload", "missing_item_url");
  }
  return urls;
}

function getRequiredReportItems(items: Record<string, unknown>[]) {
  const reportItems = items
    .map(toPersonalItemsReportItem)
    .filter((item): item is PersonalItemsReportItem => Boolean(item));
  if (reportItems.length !== items.length) {
    throw buildPersonalItemsReportError("invalid_payload", "missing_item_id");
  }
  return reportItems;
}

function getRequiredReportGenerator({
  deps,
  profile,
}: {
  deps: PersonalItemsReportServiceDeps;
  profile: unknown;
}): PersonalItemsReportContext["generateJsonWithLlm"] {
  const generateJsonWithLlm = deps.getGenerateJsonWithLlmImpl(profile);
  if (!generateJsonWithLlm) {
    throw buildPersonalItemsReportError(
      "service_unavailable",
      "llm_unavailable",
    );
  }
  return generateJsonWithLlm;
}

async function buildPersonalItemsReportContext({
  deps,
  email,
}: {
  deps: PersonalItemsReportServiceDeps;
  email: string;
}): Promise<PersonalItemsReportContext> {
  const [profile, items] = await Promise.all([
    deps.getProfileImpl(email),
    deps.listWardrobeItemsImpl({ email, source: null }),
  ]);
  if (!Array.isArray(items) || items.length === 0) {
    throw buildPersonalItemsReportError("not_found");
  }
  const sourceItems = items as Record<string, unknown>[];
  const reportItems = getRequiredReportItems(sourceItems);
  const personalItemUrls = assertCompleteUrlSnapshot(sourceItems);
  const generateJsonWithLlm = getRequiredReportGenerator({ deps, profile });

  return {
    generateJsonWithLlm,
    personalItemUrls,
    profile,
    reportItems,
    sourceItems,
  };
}

async function generateAndPersistReport({
  context,
  deps,
  email,
  personalItemsContext,
}: {
  context: PersonalItemsReportContext;
  deps: PersonalItemsReportServiceDeps;
  email: string;
  personalItemsContext?: string | null;
}): Promise<PersonalItemsReportGenerationResult> {
  const collage = await buildPersonalItemsReportCollage({
    deps,
    items: context.sourceItems,
  });
  const prompt = renderPersonalItemsReportPrompt({
    context: personalItemsContext,
    items: context.reportItems,
  });
  deps.saveLastPromptArtifactsImpl({
    prompt,
    userProfile: context.profile,
    systemPrompt: PERSONAL_ITEMS_REPORT_SYSTEM_PROMPT,
    personalItemsCollage: collage,
  });

  const llmResolution = deps.resolveLlmProviderImpl(context.profile);
  const startedAt = Date.now();
  const { response, json } = await context.generateJsonWithLlm(prompt, {
    userProfile: context.profile,
    format: buildPersonalItemsReportFormat(),
    images: [collage],
    systemPrompt: PERSONAL_ITEMS_REPORT_SYSTEM_PROMPT,
  });
  const parsedReport = parsePersonalItemsReportLlmOutput(json, {
    itemCategories: context.reportItems.map((item) => item.category),
    itemCount: context.reportItems.length,
    itemIds: context.reportItems.map((item) => item.id),
  });
  const report: PersonalItemsReport = {
    ...applyComputedPersonalItemsVerdictScore(parsedReport),
    schemaVersion: PERSONAL_ITEMS_REPORT_SCHEMA_VERSION,
  };
  const saved = await deps.upsertPersonalItemsReportImpl({
    email,
    personalItemUrls: context.personalItemUrls,
    report: report as unknown as Record<string, unknown>,
  });

  logWardrobeInfo("personal-items-report-completed", {
    itemCount: context.reportItems.length,
    llmProvider: llmResolution?.provider,
    llmModel: llmResolution?.model,
    llmDurationMs: Date.now() - startedAt,
    ...extractLlmUsage(response?.usage),
  });

  return {
    generatedAt: saved.generatedAt,
    personalItemUrls: saved.personalItemUrls,
    report,
  };
}

async function generatePersonalItemsReport(
  email: string,
  personalItemsContext?: string | null,
  deps: PersonalItemsReportServiceDepsOverrides = {},
): Promise<PersonalItemsReportGenerationResult> {
  const resolvedDeps = createPersonalItemsReportServiceDeps(deps);
  const context = await buildPersonalItemsReportContext({
    deps: resolvedDeps,
    email,
  });
  try {
    return await generateAndPersistReport({
      context,
      deps: resolvedDeps,
      email,
      personalItemsContext,
    });
  } catch (error) {
    if (isPersonalItemsReportDomainError(error)) throw error;
    logError("[personal-items-report]", {
      message: error instanceof Error ? error.message : "unknown_error",
      code: (error as { code?: string })?.code ?? null,
    });
    throw buildPersonalItemsReportError("service_unavailable");
  }
}

export { generatePersonalItemsReport, getPersonalItemUrls };
