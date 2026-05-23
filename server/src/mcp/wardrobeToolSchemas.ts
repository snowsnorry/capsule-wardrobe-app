import { z } from "zod";

const STRING_OR_NUMBER_SCHEMA = z.union([z.string(), z.number()]);
const NULLABLE_STRING_SCHEMA = z.string().nullable();
const NULLABLE_STRING_OR_NUMBER_SCHEMA = STRING_OR_NUMBER_SCHEMA.nullable();
const NULLABLE_STRING_ARRAY_SCHEMA = z.array(z.string()).nullable();
const FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA = z
  .union([z.array(z.string()), z.string()])
  .nullable();
const NULLABLE_BOOLEAN_SCHEMA = z.boolean().nullable();
export const WARDROBE_SOURCE_SCHEMA = z.enum(["uploaded", "from_catalog"]);
const WARDROBE_PROCESSING_STATUS_SCHEMA = z.enum([
  "uploaded",
  "image_processing",
  "metadata_processed",
  "needs_review",
  "ready",
  "failed",
]);

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

export const WARDROBE_ITEM_RENDER_INPUT_SCHEMA =
  WARDROBE_ITEM_OUTPUT_SCHEMA.extend({
    attributes: z.object({
      season: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      formalityLevel: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      style: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      occasions: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      colorBase: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      pattern: NULLABLE_STRING_SCHEMA,
      finish: NULLABLE_STRING_SCHEMA,
      isNeutral: NULLABLE_BOOLEAN_SCHEMA,
      composition: NULLABLE_STRING_SCHEMA,
      silhouette: NULLABLE_STRING_SCHEMA,
      fit: NULLABLE_STRING_SCHEMA,
      closureType: FLEXIBLE_NULLABLE_STRING_ARRAY_SCHEMA,
      isSavedToWardrobe: NULLABLE_BOOLEAN_SCHEMA,
    }),
  });

export const WARDROBE_ITEMS_OUTPUT_SCHEMA = z.object({
  resultType: z.literal("wardrobe_items"),
  count: z.number(),
  items: z.array(WARDROBE_ITEM_OUTPUT_SCHEMA),
});

export type WardrobeRenderInputItem = z.infer<
  typeof WARDROBE_ITEM_RENDER_INPUT_SCHEMA
>;
