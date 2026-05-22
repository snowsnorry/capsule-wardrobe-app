import { z } from "zod";

import { logError } from "../logger.js";
import type { ProductToolsDeps } from "./productTools.js";
import {
  getSearchFilterInputSchema,
  type SearchToolSchemaOptions,
} from "./productToolSchemas.js";

const STATS_DESCRIPTION =
  "Return product catalog result counts and facet statistics for wardrobe-relevant filters. Use `get_search_options` to discover valid filter values before applying filters. Prefer exact option values from `get_search_options`; do not invent filter values.";
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const STATS_ROW_OUTPUT_SCHEMA = z.object({
  value: z.string(),
  count: z.number(),
});
const STATS_OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  total: z.number(),
  stats: z.record(z.array(STATS_ROW_OUTPUT_SCHEMA)),
});

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

function toToolError(error: "invalid_payload" | "service_unavailable") {
  return toJsonToolResult({ ok: false, error }, true);
}

function isInvalidPayloadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "invalid_payload" ||
      (error as Error & { code?: string }).code === "invalid_payload")
  );
}

function toStatsRows(value: unknown) {
  return Array.isArray(value)
    ? value.map((row) => ({
        value: String((row as Record<string, unknown>)?.value || ""),
        count: Number((row as Record<string, unknown>)?.count || 0),
      }))
    : [];
}

function toStatsOutput(result: Record<string, unknown>) {
  const stats =
    result.stats && typeof result.stats === "object"
      ? Object.fromEntries(
          Object.entries(result.stats as Record<string, unknown>).map(
            ([key, rows]) => [key, toStatsRows(rows)],
          ),
        )
      : {};

  return {
    ok: true,
    total: Number(result.total || 0),
    stats,
  };
}

export function registerStatsTool(
  server,
  deps: ProductToolsDeps,
  schemaOptions: SearchToolSchemaOptions,
) {
  server.registerTool(
    "stats",
    {
      description: STATS_DESCRIPTION,
      inputSchema: getSearchFilterInputSchema(schemaOptions),
      outputSchema: STATS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => {
      try {
        const result = await deps.getSearchStatsImpl(
          deps.profileEmail,
          args || {},
        );
        return toJsonToolResult(toStatsOutput(result));
      } catch (error) {
        if (isInvalidPayloadError(error)) {
          return toToolError("invalid_payload");
        }
        logError("[mcp/stats]", error);
        return toToolError("service_unavailable");
      }
    },
  );
}
