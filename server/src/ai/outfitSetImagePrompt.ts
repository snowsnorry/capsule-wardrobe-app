import { mkdirSync, writeFileSync } from "node:fs";
import { buildOutfitSetDescription } from "./outfitSetImageDescription.js";
import {
  getPromptTemplateContent,
  loadPromptTemplate,
  renderPromptTemplateContent,
} from "./promptTemplates.js";

const IMAGE_GENERATION_PROMPT_TEMPLATE = loadPromptTemplate(
  new URL("../templates/prompt_image_generation.yaml", import.meta.url),
);
const PROMPT_TEMPLATE = getPromptTemplateContent(
  IMAGE_GENERATION_PROMPT_TEMPLATE,
  "user",
);
const LAST_PROMPT_DIR_URL = new URL("../../../last-prompt/", import.meta.url);

function buildPromptFromTemplate(
  items,
  {
    promptTemplate = PROMPT_TEMPLATE,
    buildOutfitSetDescriptionImpl = buildOutfitSetDescription,
  } = {},
) {
  const description = buildOutfitSetDescriptionImpl(items);
  const template = String(promptTemplate || "");
  const rendered = renderPromptTemplateContent(
    template,
    {
      description,
    },
    "outfit set image prompt",
  );
  return template.includes("{{description}}")
    ? rendered
    : [rendered, description]
        .filter((part) => part.trim().length > 0)
        .join("\n\n");
}

function saveOutfitSetDebugArtifacts({ prompt }) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  mkdirSync(LAST_PROMPT_DIR_URL, { recursive: true });
  writeFileSync(
    new URL("outfit_set_last_prompt.txt", LAST_PROMPT_DIR_URL),
    String(prompt || ""),
    "utf8",
  );
}

export { buildPromptFromTemplate, saveOutfitSetDebugArtifacts };
