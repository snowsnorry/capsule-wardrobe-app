import { z } from "zod";

import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import { buildMcpImageThumbnailUrl } from "./mcpImageThumbnails.js";

const WARDROBE_ITEMS_DESCRIPTION =
  "Return the authenticated user's wardrobe items, including uploaded items and saved catalog items. Optionally filter by `source`: `uploaded` or `from_catalog`.";

const STRING_OR_NUMBER_SCHEMA = z.union([z.string(), z.number()]);
const NULLABLE_STRING_SCHEMA = z.string().nullable();
const NULLABLE_STRING_OR_NUMBER_SCHEMA = STRING_OR_NUMBER_SCHEMA.nullable();
const STRING_OR_STRING_ARRAY_SCHEMA = z.union([
  z.string(),
  z.array(z.string()),
]);
const NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA =
  STRING_OR_STRING_ARRAY_SCHEMA.nullable();
const NULLABLE_BOOLEAN_SCHEMA = z.boolean().nullable();
const WARDROBE_SOURCE_SCHEMA = z.enum(["uploaded", "from_catalog"]);
const WARDROBE_PROCESSING_STATUS_SCHEMA = z.enum([
  "uploaded",
  "image_processing",
  "metadata_processed",
  "needs_review",
  "ready",
  "failed",
]);
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const WARDROBE_ITEM_OUTPUT_SCHEMA = z
  .object({
    id: STRING_OR_NUMBER_SCHEMA.optional(),
    name: NULLABLE_STRING_SCHEMA.optional(),
    url: NULLABLE_STRING_SCHEMA.optional(),
    description: NULLABLE_STRING_SCHEMA.optional(),
    brand: NULLABLE_STRING_SCHEMA.optional(),
    price: NULLABLE_STRING_OR_NUMBER_SCHEMA.optional(),
    currency: NULLABLE_STRING_SCHEMA.optional(),
    availability: NULLABLE_STRING_SCHEMA.optional(),
    imageUrl: NULLABLE_STRING_SCHEMA.optional(),
    audience: NULLABLE_STRING_SCHEMA.optional(),
    category: NULLABLE_STRING_SCHEMA.optional(),
    season: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    formalityLevel: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    style: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    occasions: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    colorBase: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    pattern: NULLABLE_STRING_SCHEMA.optional(),
    finish: NULLABLE_STRING_SCHEMA.optional(),
    isNeutral: NULLABLE_BOOLEAN_SCHEMA.optional(),
    composition: NULLABLE_STRING_SCHEMA.optional(),
    silhouette: NULLABLE_STRING_SCHEMA.optional(),
    fit: NULLABLE_STRING_SCHEMA.optional(),
    closureType: NULLABLE_STRING_OR_STRING_ARRAY_SCHEMA.optional(),
    source: WARDROBE_SOURCE_SCHEMA.optional(),
    rawImageUrl: NULLABLE_STRING_SCHEMA.optional(),
    processingStatus: WARDROBE_PROCESSING_STATUS_SCHEMA.optional(),
  })
  .passthrough();

const WARDROBE_ITEMS_OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  items: z.array(WARDROBE_ITEM_OUTPUT_SCHEMA),
});

type WardrobeToolsDeps = {
  profileEmail: string;
  listWardrobeItemsImpl: (payload: {
    email: string;
    source?: "uploaded" | "from_catalog" | null;
  }) => Promise<unknown>;
};

function toJsonToolResult(payload: Record<string, unknown>, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload),
      },
    ],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

function toToolError(error: "service_unavailable") {
  return toJsonToolResult({ ok: false, error }, true);
}

function toWardrobeItemToolOutput(item: unknown) {
  const displayItem = filterWardrobeItemForDisplay(item) as Record<
    string,
    unknown
  >;
  return {
    ...displayItem,
    imageUrl: buildMcpImageThumbnailUrl(displayItem.imageUrl, {
      source: displayItem.source,
    }),
  };
}

function registerWardrobeItemsTool(server, deps: WardrobeToolsDeps) {
  server.registerTool(
    "wardrobe_items",
    {
      description: WARDROBE_ITEMS_DESCRIPTION,
      inputSchema: {
        source: WARDROBE_SOURCE_SCHEMA.optional(),
      },
      outputSchema: WARDROBE_ITEMS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      try {
        const items = await deps.listWardrobeItemsImpl({
          email: deps.profileEmail,
          source: args?.source ?? null,
        });
        return toJsonToolResult({
          ok: true,
          items: Array.isArray(items)
            ? items.map(toWardrobeItemToolOutput)
            : [],
        });
      } catch (error) {
        logError("[mcp/wardrobe_items]", error);
        return toToolError("service_unavailable");
      }
    },
  );
}

export function registerWardrobeTools(server, deps: WardrobeToolsDeps) {
  registerWardrobeItemsTool(server, deps);
}
