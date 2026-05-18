type AnchorValidationDeps = {
  listWardrobeItemsByIdsImpl: (payload: {
    email: string;
    ids: number[];
  }) => Promise<Array<Record<string, unknown>>>;
};

type ValidatedCapsuleAnchors = {
  anchorWardrobeItemIds: string[];
  anchorWardrobeNumericIds: number[];
  anchorItems: Array<Record<string, unknown>>;
};

const MAX_ANCHOR_ITEMS = 5;
const ANCHOR_ID_PATTERN = /^W([1-9]\d*)$/i;

function invalidPayload(): Error {
  const error = new Error("invalid_payload");
  (error as { code?: string }).code = "invalid_payload";
  return error;
}

function normalizeAnchorPublicIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((id) =>
          String(id || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ];
}

function parseAnchorPublicIds(value: unknown): {
  publicIds: string[];
  numericIds: number[];
} {
  const publicIds = normalizeAnchorPublicIds(value);
  if (publicIds.length > MAX_ANCHOR_ITEMS) {
    throw invalidPayload();
  }

  const numericIds = publicIds.map((id) => {
    const match = id.match(ANCHOR_ID_PATTERN);
    if (!match) {
      throw invalidPayload();
    }
    return Number(match[1]);
  });

  return { publicIds, numericIds };
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

async function validateCapsuleAnchorItems({
  email,
  anchorWardrobeItemIds,
  deps,
}: {
  email: string;
  anchorWardrobeItemIds: unknown;
  deps: AnchorValidationDeps;
}): Promise<ValidatedCapsuleAnchors> {
  const { publicIds, numericIds } = parseAnchorPublicIds(anchorWardrobeItemIds);
  if (publicIds.length === 0) {
    return {
      anchorWardrobeItemIds: [],
      anchorWardrobeNumericIds: [],
      anchorItems: [],
    };
  }

  const rows = await deps.listWardrobeItemsByIdsImpl({
    email,
    ids: numericIds,
  });
  const rowsByPublicId = new Map(rows.map((row) => [getRowPublicId(row), row]));
  const anchorItems = publicIds.map((id) => {
    const row = rowsByPublicId.get(id);
    if (!row || !hasReadyCategory(row)) {
      throw invalidPayload();
    }
    return toAnchorGenerationItem(row);
  });

  return {
    anchorWardrobeItemIds: publicIds,
    anchorWardrobeNumericIds: numericIds,
    anchorItems,
  };
}

export { parseAnchorPublicIds, validateCapsuleAnchorItems };
