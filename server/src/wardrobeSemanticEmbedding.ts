import { getDocumentEmbeddings } from "./ai/voyageai.js";

type WardrobeEmbeddingItem = {
  name?: unknown;
  description?: unknown;
  brand?: unknown;
  audience?: unknown;
  category?: unknown;
  category_root?: unknown;
  color_base?: unknown;
  colorBase?: unknown;
  pattern?: unknown;
  composition?: unknown;
  materials?: unknown;
  style?: unknown;
  silhouette?: unknown;
  fit?: unknown;
  formality_level?: unknown;
  formalityLevel?: unknown;
  occasions?: unknown;
  season?: unknown;
  closure_type?: unknown;
  closureType?: unknown;
};

function formatList(value: unknown, defaultValue = "versatile"): string {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
    return items.length > 0 ? items.join(", ") : defaultValue;
  }

  const normalized = String(value).trim();
  return normalized || defaultValue;
}

function getText(value: unknown, defaultValue = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || defaultValue;
}

function buildUploadedWardrobeSemanticSummary(
  item: WardrobeEmbeddingItem,
): string {
  const brand = getText(item.brand, "Unknown brand");
  const name = getText(item.name, "Unknown model");
  const audience = getText(item.audience, "unisex");
  const categoryRoot = getText(
    item.category,
    getText(item.category_root, "item"),
  );
  const description = getText(item.description);
  const colorBase = formatList(item.color_base ?? item.colorBase, "");
  const materials = formatList(item.composition ?? item.materials, "");
  const pattern = getText(item.pattern, "solid");
  const style = formatList(item.style, "modern");
  const silhouette = getText(item.silhouette, "standard");
  const fit = getText(item.fit);
  const formality = formatList(
    item.formality_level ?? item.formalityLevel,
    "general",
  );
  const occasions = formatList(item.occasions, "everyday use");
  const season = formatList(item.season, "all seasons");
  const closure = formatList(
    item.closure_type ?? item.closureType,
    "standard closure",
  );

  const fitPhrase = fit ? ` and a ${fit} fit` : "";
  const closurePhrase =
    closure !== "standard closure" ? `Fastens with a ${closure}.` : "";
  const template = [
    `A ${audience} ${colorBase} ${pattern} ${categoryRoot} by ${brand}. Model: ${name}. `,
    `Aesthetics & Fit: Designed in a ${style} style with a ${silhouette} silhouette${fitPhrase}. `,
    `Usage: Suitable for ${formality} dress codes. Ideal for ${occasions} during the ${season} seasons. `,
    `Materials & Construction: ${closurePhrase} Crafted from ${materials}. `,
    `Key features: ${description}`,
  ].join("\n");

  return template.replace(/ +/g, " ").trim();
}

async function createUploadedWardrobeItemEmbedding(
  item: WardrobeEmbeddingItem,
): Promise<number[]> {
  return getDocumentEmbeddings(buildUploadedWardrobeSemanticSummary(item));
}

export {
  buildUploadedWardrobeSemanticSummary,
  createUploadedWardrobeItemEmbedding,
};
export type { WardrobeEmbeddingItem };
