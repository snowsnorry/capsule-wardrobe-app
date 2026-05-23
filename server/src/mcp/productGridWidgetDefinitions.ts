const PRODUCT_GRID_WIDGET_URI = "ui://capsule/product-grid.v7.html";
const PRODUCT_DETAIL_WIDGET_URI = "ui://capsule/product-detail.v7.html";
const WARDROBE_GRID_WIDGET_URI = "ui://capsule/wardrobe-grid.v7.html";
const CARD_GRID_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

const PRODUCT_GRID_WIDGET_DEFINITION = {
  name: "product_grid_widget",
  uri: PRODUCT_GRID_WIDGET_URI,
  title: "Product grid",
  description:
    "A responsive product grid with images, prices, badges, and product links.",
} as const;
const PRODUCT_DETAIL_WIDGET_DEFINITION = {
  name: "product_detail_widget",
  uri: PRODUCT_DETAIL_WIDGET_URI,
  title: "Product detail",
  description:
    "A product detail card with image, price, badges, and product link.",
} as const;
const WARDROBE_GRID_WIDGET_DEFINITION = {
  name: "wardrobe_grid_widget",
  uri: WARDROBE_GRID_WIDGET_URI,
  title: "Wardrobe grid",
  description:
    "A responsive wardrobe grid with item images, sources, statuses, and product links.",
} as const;

const CARD_GRID_WIDGET_DEFINITIONS = [
  PRODUCT_GRID_WIDGET_DEFINITION,
  PRODUCT_DETAIL_WIDGET_DEFINITION,
  WARDROBE_GRID_WIDGET_DEFINITION,
] as const;

function buildWidgetResourceLink(
  definition: (typeof CARD_GRID_WIDGET_DEFINITIONS)[number],
) {
  return {
    type: "resource_link" as const,
    uri: definition.uri,
    name: definition.name,
    title: definition.title,
    description: definition.description,
    mimeType: CARD_GRID_WIDGET_MIME_TYPE,
  };
}

type WidgetResourceLink = ReturnType<typeof buildWidgetResourceLink>;

const PRODUCT_GRID_WIDGET_RESOURCE_LINK = buildWidgetResourceLink(
  PRODUCT_GRID_WIDGET_DEFINITION,
);
const PRODUCT_DETAIL_WIDGET_RESOURCE_LINK = buildWidgetResourceLink(
  PRODUCT_DETAIL_WIDGET_DEFINITION,
);
const WARDROBE_GRID_WIDGET_RESOURCE_LINK = buildWidgetResourceLink(
  WARDROBE_GRID_WIDGET_DEFINITION,
);

export {
  CARD_GRID_WIDGET_DEFINITIONS,
  CARD_GRID_WIDGET_MIME_TYPE,
  PRODUCT_DETAIL_WIDGET_RESOURCE_LINK,
  PRODUCT_DETAIL_WIDGET_URI,
  PRODUCT_GRID_WIDGET_RESOURCE_LINK,
  PRODUCT_GRID_WIDGET_URI,
  WARDROBE_GRID_WIDGET_RESOURCE_LINK,
  WARDROBE_GRID_WIDGET_URI,
  type WidgetResourceLink,
};
