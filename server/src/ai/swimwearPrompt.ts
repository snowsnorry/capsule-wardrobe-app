import { formatItemColor } from "./swimwearUtils.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";
import type { SwimwearCandidate } from "./types.js";

const SWIMWEAR_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_woman_swimwear.yaml", import.meta.url),
);
const PROMPT_TEMPLATE = getPromptTemplateContent(
  SWIMWEAR_PROMPT_TEMPLATE,
  "user",
);
const SYSTEM_PROMPT_TEMPLATE = getPromptTemplateContent(
  SWIMWEAR_PROMPT_TEMPLATE,
  "system",
);

function buildBottomsContext(selectedCapsuleItems: SwimwearCandidate[]) {
  const bottoms = selectedCapsuleItems.filter(
    (item) => item?.category === "bottom",
  );

  return bottoms
    .map(
      (item, index) =>
        `${index + 1}. ${item?.name || "Unnamed item"} (Color: ${formatItemColor(item)}) - ID: ${item?.id ?? "unknown"}`,
    )
    .join("\n");
}

function buildSwimwearCandidatesPayload(candidates: SwimwearCandidate[]) {
  return JSON.stringify(
    candidates.map((item) => ({
      id: item?.id ?? null,
      name: item?.name ?? "",
      swimwear_type: item?.swimwear_type ?? "swimsuit",
      color: formatItemColor(item),
      pattern:
        typeof item?.pattern === "string" && item.pattern.trim().length > 0
          ? item.pattern.trim()
          : "solid",
      style: Array.isArray(item?.style) ? item.style : [],
    })),
    null,
    2,
  );
}

function getSwimwearPrompt(
  selectedCapsuleItems: SwimwearCandidate[],
  candidates: SwimwearCandidate[],
) {
  return renderPromptTemplateContent(
    PROMPT_TEMPLATE,
    {
      bottoms_context: buildBottomsContext(selectedCapsuleItems),
      swimwear_candidates: buildSwimwearCandidatesPayload(candidates),
    },
    "swimwear prompt",
  );
}

function getSwimwearSystemPrompt() {
  return SYSTEM_PROMPT_TEMPLATE;
}

export { getSwimwearPrompt, getSwimwearSystemPrompt };
