type AnchorValidationDeps = {
  listWardrobeItemsByIdsImpl: (payload: {
    email: string;
    ids: number[];
  }) => Promise<Array<Record<string, unknown>>>;
  getProductsByUrlsForEmailImpl?: (payload: {
    email: string;
    urls: string[];
  }) => Promise<Array<Record<string, unknown>>>;
};

type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

type ValidatedCapsuleAnchors = {
  anchorWardrobeNumericIds: number[];
  anchorCatalogUrls: string[];
  anchorItemRefs: AnchorItemRef[];
  anchorItems: Array<Record<string, unknown>>;
};

const MAX_ANCHOR_ITEMS = 5;
const WARDROBE_URL_PATTERN = /^wardrobe:\/\/([1-9]\d*)$/i;

function isAnchorItemSource(value: unknown): value is AnchorItemRef["source"] {
  return value === "uploaded" || value === "from_catalog";
}

function invalidPayload(): Error {
  const error = new Error("invalid_payload");
  (error as { code?: string }).code = "invalid_payload";
  return error;
}

function readAnchorItemRef(item: unknown): AnchorItemRef {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw invalidPayload();
  }
  const source = (item as Record<string, unknown>).source;
  const url = String((item as Record<string, unknown>).url || "").trim();
  if (!isAnchorItemSource(source) || !url) {
    throw invalidPayload();
  }
  return { source, url };
}

function normalizeAnchorItemRefs(value: unknown): AnchorItemRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const refs: AnchorItemRef[] = [];
  for (const item of value) {
    const ref = readAnchorItemRef(item);
    const key = `${ref.source}\u0000${ref.url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

function parseUploadedRefs(refs: AnchorItemRef[]) {
  const publicIds: string[] = [];
  const numericIds: number[] = [];
  for (const ref of refs.filter((item) => item.source === "uploaded")) {
    const match = ref.url.match(WARDROBE_URL_PATTERN);
    if (!match) {
      throw invalidPayload();
    }
    const publicId = `W${match[1]}`;
    if (!publicIds.includes(publicId)) {
      publicIds.push(publicId);
      numericIds.push(Number(match[1]));
    }
  }
  return { publicIds, numericIds };
}

function getUploadedPublicIdFromRef(ref: AnchorItemRef): string {
  const match = ref.url.match(WARDROBE_URL_PATTERN);
  return match ? `W${match[1]}` : "";
}

function getRowPublicId(row: Record<string, unknown>): string {
  return `W${Number(row.id)}`;
}

function hasReadyCategory(row: Record<string, unknown>): boolean {
  return (
    row.processingStatus === "ready" &&
    typeof row.category === "string" &&
    row.category.trim().length > 0
  );
}

function toAnchorGenerationItem(row: Record<string, unknown>) {
  return {
    ...row,
    id: getRowPublicId(row),
    item_source: "wardrobe",
    selection_role: "anchor",
    wardrobe_id: String(row.id),
  };
}

function getProductRowPublicId(row: Record<string, unknown>): string {
  return String(row.id || "").trim();
}

function hasCategory(row: Record<string, unknown>): boolean {
  return typeof row.category === "string" && row.category.trim().length > 0;
}

function toCatalogAnchorGenerationItem(row: Record<string, unknown>) {
  return {
    ...row,
    id: getProductRowPublicId(row),
    item_source: "catalog",
    selection_role: "anchor",
    product_id: getProductRowPublicId(row),
  };
}

async function validateCapsuleAnchorItems({
  email,
  anchorItemRefs,
  deps,
}: {
  email: string;
  anchorItemRefs?: unknown;
  deps: AnchorValidationDeps;
}): Promise<ValidatedCapsuleAnchors> {
  const refs = normalizeAnchorItemRefs(anchorItemRefs);
  if (refs.length > MAX_ANCHOR_ITEMS) {
    throw invalidPayload();
  }
  const { publicIds, numericIds } = parseUploadedRefs(refs);
  const catalogUrls = refs
    .filter((ref) => ref.source === "from_catalog")
    .map((ref) => ref.url);
  if (refs.length === 0) {
    return {
      anchorWardrobeNumericIds: [],
      anchorCatalogUrls: [],
      anchorItemRefs: [],
      anchorItems: [],
    };
  }

  const rows = await deps.listWardrobeItemsByIdsImpl({
    email,
    ids: numericIds,
  });
  const rowsByPublicId = new Map(rows.map((row) => [getRowPublicId(row), row]));
  const wardrobeAnchorItemsById = new Map(
    publicIds.map((id) => {
      const row = rowsByPublicId.get(id);
      if (!row || !hasReadyCategory(row)) {
        throw invalidPayload();
      }
      return [id, toAnchorGenerationItem(row)];
    }),
  );
  const productRows = deps.getProductsByUrlsForEmailImpl
    ? await deps.getProductsByUrlsForEmailImpl({ email, urls: catalogUrls })
    : [];
  const productRowsByUrl = new Map(
    productRows.map((row) => [String(row.url || "").trim(), row]),
  );
  const catalogAnchorItemsByUrl = new Map(
    catalogUrls.map((url) => {
      const row = productRowsByUrl.get(url);
      if (!row || !hasCategory(row)) {
        throw invalidPayload();
      }
      return [url, toCatalogAnchorGenerationItem(row)];
    }),
  );
  const anchorItems = refs.map((ref) => {
    if (ref.source === "uploaded") {
      return wardrobeAnchorItemsById.get(getUploadedPublicIdFromRef(ref));
    }
    return catalogAnchorItemsByUrl.get(ref.url);
  });
  if (anchorItems.some((item) => !item)) {
    throw invalidPayload();
  }

  return {
    anchorWardrobeNumericIds: numericIds,
    anchorCatalogUrls: catalogUrls,
    anchorItemRefs: refs,
    anchorItems: anchorItems as Array<Record<string, unknown>>,
  };
}

export { validateCapsuleAnchorItems };
