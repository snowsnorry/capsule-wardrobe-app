import { z } from "zod";

import { logError } from "../logger.js";
import { filterWardrobeItemForDisplay } from "../wardrobeItemDisplay.js";
import { buildMcpImageThumbnailUrl } from "./mcpImageThumbnails.js";
import { WARDROBE_GRID_WIDGET_URI } from "./productGridWidget.js";

const WARDROBE_ITEMS_DESCRIPTION =
  "Return the authenticated user's wardrobe items, including uploaded items and saved catalog items. Optionally filter by `source`: `uploaded` or `from_catalog`. To show wardrobe cards in ChatGPT, call `render_wardrobe_grid` with the returned `items`.";
const RENDER_WARDROBE_GRID_DESCRIPTION =
  "Render wardrobe items returned by `wardrobe_items` as ChatGPT wardrobe cards. Call this after `wardrobe_items` when the user wants to see images or a visual grid.";

const STRING_OR_NUMBER_SCHEMA = z.union([z.string(), z.number()]);
const NULLABLE_STRING_SCHEMA = z.string().nullable();
const NULLABLE_STRING_OR_NUMBER_SCHEMA = STRING_OR_NUMBER_SCHEMA.nullable();
const NULLABLE_STRING_ARRAY_SCHEMA = z.array(z.string()).nullable();
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
const WARDROBE_GRID_RENDER_TOOL_META = {
  ui: {
    resourceUri: WARDROBE_GRID_WIDGET_URI,
  },
  "openai/outputTemplate": WARDROBE_GRID_WIDGET_URI,
  "openai/toolInvocation/invoking": "Loading wardrobe",
  "openai/toolInvocation/invoked": "Wardrobe ready",
} as const;

const WARDROBE_ITEM_OUTPUT_SCHEMA = z
  .object({
    id: z.string(),
    name: z.string(),
    brand: NULLABLE_STRING_SCHEMA,
    url: z.string(),
    description: NULLABLE_STRING_SCHEMA,
    price: z.object({
      amount: NULLABLE_STRING_OR_NUMBER_SCHEMA,
      currency: NULLABLE_STRING_SCHEMA,
      display: NULLABLE_STRING_SCHEMA,
    }),
    availability: NULLABLE_STRING_SCHEMA,
    image: NULLABLE_STRING_SCHEMA,
    audience: NULLABLE_STRING_SCHEMA,
    category: NULLABLE_STRING_SCHEMA,
    attributes: z.object({
      season: NULLABLE_STRING_ARRAY_SCHEMA,
      formalityLevel: NULLABLE_STRING_ARRAY_SCHEMA,
      style: NULLABLE_STRING_ARRAY_SCHEMA,
      occasions: NULLABLE_STRING_ARRAY_SCHEMA,
      colorBase: NULLABLE_STRING_ARRAY_SCHEMA,
      pattern: NULLABLE_STRING_SCHEMA,
      finish: NULLABLE_STRING_SCHEMA,
      isNeutral: NULLABLE_BOOLEAN_SCHEMA,
      composition: NULLABLE_STRING_SCHEMA,
      silhouette: NULLABLE_STRING_SCHEMA,
      fit: NULLABLE_STRING_SCHEMA,
      closureType: NULLABLE_STRING_ARRAY_SCHEMA,
      isSavedToWardrobe: NULLABLE_BOOLEAN_SCHEMA,
    }),
    source: WARDROBE_SOURCE_SCHEMA.nullable(),
    processingStatus: WARDROBE_PROCESSING_STATUS_SCHEMA.nullable(),
  })
  .strict();

const WARDROBE_ITEMS_OUTPUT_SCHEMA = z.object({
  resultType: z.literal("wardrobe_items"),
  count: z.number(),
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

function toTextToolResult(
  structuredContent: Record<string, unknown>,
  text: string,
  meta?: Record<string, unknown>,
) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent,
    ...(meta ? { _meta: meta } : {}),
  };
}

function toToolError(error: "service_unavailable") {
  return toJsonToolResult({ ok: false, error }, true);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nullablePrice(value: unknown): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function nullableStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  return typeof value === "string" ? [value] : null;
}

function nullableWardrobeSource(
  value: unknown,
): "uploaded" | "from_catalog" | null {
  return value === "uploaded" || value === "from_catalog" ? value : null;
}

function nullableProcessingStatus(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getPriceDisplay(
  amount: number | string | null,
  currency: string | null,
) {
  if (amount == null) {
    return null;
  }
  return currency ? `${String(amount)} ${currency}` : String(amount);
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function markdownImageAlt(value: string): string {
  return value.replace(/[[\]\n\r]/g, " ").trim() || "Wardrobe item";
}

function firstString(value: string[] | null): string | null {
  return value?.[0] || null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toWardrobeItemToolOutput(item: unknown) {
  const displayItem = filterWardrobeItemForDisplay(item) as Record<
    string,
    unknown
  >;
  const amount = nullablePrice(displayItem.price);
  const currency = nullableString(displayItem.currency);
  const source = nullableWardrobeSource(displayItem.source);
  const season = nullableStringArray(displayItem.season);
  const style = nullableStringArray(displayItem.style);

  return {
    id: String(displayItem.id || ""),
    name: String(displayItem.name || ""),
    brand: nullableString(displayItem.brand),
    url: String(displayItem.url || ""),
    description: nullableString(displayItem.description),
    price: {
      amount,
      currency,
      display: getPriceDisplay(amount, currency),
    },
    availability: nullableString(displayItem.availability),
    image: buildMcpImageThumbnailUrl(displayItem.imageUrl, { source }),
    audience: nullableString(displayItem.audience),
    category: nullableString(displayItem.category),
    attributes: {
      season,
      formalityLevel: nullableStringArray(displayItem.formalityLevel),
      style,
      occasions: nullableStringArray(displayItem.occasions),
      colorBase: nullableStringArray(displayItem.colorBase),
      pattern: nullableString(displayItem.pattern),
      finish: nullableString(displayItem.finish),
      isNeutral: nullableBoolean(displayItem.isNeutral),
      composition: nullableString(displayItem.composition),
      silhouette: nullableString(displayItem.silhouette),
      fit: nullableString(displayItem.fit),
      closureType: nullableStringArray(displayItem.closureType),
      isSavedToWardrobe: nullableBoolean(displayItem.isSavedToWardrobe),
    },
    source,
    processingStatus: nullableProcessingStatus(displayItem.processingStatus),
  };
}

type NormalizedWardrobeItem = ReturnType<typeof toWardrobeItemToolOutput>;

function buildWardrobeCard(item: NormalizedWardrobeItem) {
  const primaryAction =
    item.source === "from_catalog" && isHttpUrl(item.url)
      ? {
          type: "open_external",
          label: "Open product",
          url: item.url,
        }
      : undefined;

  return {
    type: "wardrobe_item_card",
    itemId: item.id,
    title: item.name,
    subtitle:
      compactStrings([item.brand, item.price.display]).join(" · ") ||
      item.category ||
      "",
    image: item.image,
    badges: compactStrings([
      item.source,
      item.processingStatus,
      item.category,
      firstString(item.attributes.season),
      firstString(item.attributes.style),
    ]),
    ...(primaryAction ? { primaryAction } : {}),
  };
}

function buildWardrobeItemsMeta(items: NormalizedWardrobeItem[]) {
  return {
    ui: {
      component: "wardrobe_grid",
      version: "1.0",
      layout: "responsive_grid",
      itemOrder: items.map((item) => item.id),
    },
    cards: items.map(buildWardrobeCard),
  };
}

function formatWardrobeItemsText(items: NormalizedWardrobeItem[]) {
  if (items.length === 0) {
    return "Found 0 wardrobe items.";
  }

  const lines = [`Found ${items.length} wardrobe items:`];
  items.slice(0, 10).forEach((item, index) => {
    const summary =
      compactStrings([
        item.name,
        item.brand,
        item.price.display,
        item.source,
        item.processingStatus,
      ]).join(" - ") ||
      item.name ||
      item.id;
    lines.push(`${index + 1}. ${summary}`);
    if (item.image) {
      lines.push(`   ![${markdownImageAlt(item.name)}](${item.image})`);
    }
    if (item.source === "from_catalog" && isHttpUrl(item.url)) {
      lines.push(`   ${item.url}`);
    }
  });

  return lines.join("\n");
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
        const normalizedItems = Array.isArray(items)
          ? items.map(toWardrobeItemToolOutput)
          : [];
        return toTextToolResult(
          {
            resultType: "wardrobe_items",
            count: normalizedItems.length,
            items: normalizedItems,
          },
          formatWardrobeItemsText(normalizedItems),
          buildWardrobeItemsMeta(normalizedItems),
        );
      } catch (error) {
        logError("[mcp/wardrobe_items]", error);
        return toToolError("service_unavailable");
      }
    },
  );
}

function registerRenderWardrobeGridTool(server) {
  server.registerTool(
    "render_wardrobe_grid",
    {
      description: RENDER_WARDROBE_GRID_DESCRIPTION,
      inputSchema: {
        items: z.array(WARDROBE_ITEM_OUTPUT_SCHEMA),
      },
      outputSchema: WARDROBE_ITEMS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      _meta: WARDROBE_GRID_RENDER_TOOL_META,
    },
    async (args) => {
      const items = Array.isArray(args?.items)
        ? (args.items as NormalizedWardrobeItem[])
        : [];
      return toTextToolResult(
        {
          resultType: "wardrobe_items",
          count: items.length,
          items,
        },
        formatWardrobeItemsText(items),
        buildWardrobeItemsMeta(items),
      );
    },
  );
}

export function registerWardrobeTools(server, deps: WardrobeToolsDeps) {
  registerWardrobeItemsTool(server, deps);
  registerRenderWardrobeGridTool(server);
}
