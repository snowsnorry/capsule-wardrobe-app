import { THUMBNAIL_ASSET_BASE_URL } from "../appConfig.js";

const PRODUCT_GRID_WIDGET_URI = "ui://capsule/product-grid.v7.html";
const PRODUCT_DETAIL_WIDGET_URI = "ui://capsule/product-detail.v7.html";
const WARDROBE_GRID_WIDGET_URI = "ui://capsule/wardrobe-grid.v7.html";
const CARD_GRID_WIDGET_MIME_TYPE = "text/html;profile=mcp-app";
const CARD_GRID_WIDGET_DEFINITIONS = [
  {
    name: "product_grid_widget",
    uri: PRODUCT_GRID_WIDGET_URI,
    title: "Product grid",
    description:
      "A responsive product grid with images, prices, badges, and product links.",
  },
  {
    name: "product_detail_widget",
    uri: PRODUCT_DETAIL_WIDGET_URI,
    title: "Product detail",
    description:
      "A product detail card with image, price, badges, and product link.",
  },
  {
    name: "wardrobe_grid_widget",
    uri: WARDROBE_GRID_WIDGET_URI,
    title: "Wardrobe grid",
    description:
      "A responsive wardrobe grid with item images, sources, statuses, and product links.",
  },
] as const;
const DEFAULT_ASSET_ORIGIN = "https://assets.capsule-wardrobe.org";

function normalizeHttpOrigin(value: string | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function getResourceDomains() {
  return uniqueStrings([
    normalizeHttpOrigin(THUMBNAIL_ASSET_BASE_URL),
    DEFAULT_ASSET_ORIGIN,
  ]);
}

function buildCardGridWidgetMeta(description: string) {
  const resourceDomains = getResourceDomains();
  const ui = {
    prefersBorder: true,
    csp: {
      connectDomains: [],
      resourceDomains,
    },
  };

  return {
    ui,
    "openai/widgetDescription": description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: resourceDomains,
      redirect_domains: ["https://www.stories.com", "https://example.com"],
    },
  };
}

const CARD_GRID_WIDGET_HTML = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        background: transparent;
        color: CanvasText;
      }

      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: 10px; padding: 2px; }

      .card {
        overflow: hidden;
        border: 1px solid color-mix(in oklch, CanvasText 16%, transparent);
        border-radius: 0;
        background: oklch(97% 0.006 88);
        text-decoration: none;
        color: inherit;
      }

      .image { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; background: oklch(95% 0.004 88); }

      .body { display: grid; gap: 8px; padding: 12px 12px 14px; }

      .title {
        font-size: 14px;
        font-weight: 680;
        line-height: 1.2;
      }

      .subtitle {
        color: color-mix(in oklch, CanvasText 62%, transparent);
        font-size: 12px;
        line-height: 1.25;
      }

      .badges { display: flex; flex-wrap: wrap; gap: 4px; min-height: 20px; }

      .badge {
        border: 1px solid color-mix(in oklch, CanvasText 10%, transparent);
        border-radius: 999px;
        background: color-mix(in oklch, CanvasText 7%, transparent);
        padding: 3px 8px 4px;
        font-size: 11px;
        line-height: 1.1;
      }

      .badge.category {
        border-color: color-mix(in oklch, oklch(46% 0.085 184) 20%, transparent);
        background: oklch(91% 0.028 181);
        color: oklch(39% 0.08 184);
        font-weight: 620;
      }

      .empty { padding: 16px; color: color-mix(in srgb, CanvasText 68%, transparent); font-size: 13px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main id="root" class="empty">No items to display.</main>
    <script>
      const root = document.getElementById("root");
      let hasReceivedProductPayload = false;

      function firstArray(values) { const arrays = values.filter(Array.isArray); return arrays.find((value) => value.length) || arrays[0]; }

      function getCards(globals) {
        const rawOutput = globals.toolOutput || globals.structuredContent || {};
        const output = rawOutput.structuredContent || rawOutput;
        const metadata =
          globals.toolResponseMetadata || rawOutput._meta || globals._meta || {};
        const cards = firstArray([metadata.cards, rawOutput.cards]);
        if (cards && cards.length) return cards;
        const items = firstArray([
          output.items,
          globals.toolInput && globals.toolInput.items,
          metadata.items,
        ]);
        return items ? buildCardsFromItems(items) : cards;
      }

      function getImageUrl(item) {
        if (typeof item.image === "string") return item.image;
        if (item.image && typeof item.image.url === "string") return item.image.url;
        return typeof item.imageUrl === "string" ? item.imageUrl : null;
      }

      function buildCardsFromItems(items) {
        return Array.isArray(items)
          ? items.map((item) => ({
              type: "item_card",
              itemId: item.id,
              title: item.name,
              subtitle: [item.brand, item.price && item.price.display].filter(Boolean).join(" - "),
              image: getImageUrl(item),
              badges: [
                item.category,
                ...(item.attributes && Array.isArray(item.attributes.season) ? item.attributes.season : []),
              ].filter(Boolean),
              primaryAction:
                typeof item.url === "string"
                  ? { type: "open_external", label: "Open", url: item.url }
                  : null,
            }))
          : [];
      }

      function openCard(event, url) {
        const openai = window.openai || {};
        if (!url || !openai.openExternal) {
          return;
        }
        event.preventDefault();
        openai.openExternal({ href: url, redirectUrl: false });
      }

      function renderCard(card) {
        const href = card.primaryAction && card.primaryAction.url;
        const element = document.createElement(href ? "a" : "article");
        element.className = "card";
        if (href) {
          element.href = href;
          element.target = "_blank";
          element.rel = "noreferrer";
          element.addEventListener("click", (event) => openCard(event, href));
        }

        const image = document.createElement("img");
        image.className = "image";
        image.src = card.image || "";
        image.alt = card.title || "Product";
        image.loading = "lazy";

        const body = document.createElement("div");
        body.className = "body";

        const title = document.createElement("div");
        title.className = "title";
        title.textContent = card.title || "Untitled product";

        const subtitle = document.createElement("div");
        subtitle.className = "subtitle";
        subtitle.textContent = card.subtitle || "";

        const badges = document.createElement("div");
        badges.className = "badges";
        const labels = Array.isArray(card.badges) ? card.badges : [];
        for (const [index, label] of labels.entries()) {
          const badge = document.createElement("span");
          badge.className = index === 0 ? "badge category" : "badge";
          badge.textContent = label;
          badges.appendChild(badge);
        }

        body.append(title, subtitle, badges);
        element.append(image, body);
        return element;
      }

      function render(globals) {
        const cards = getCards(globals || window.openai || {});
        if (cards === undefined) {
          if (!hasReceivedProductPayload) renderEmpty("Waiting for product payload.", globals);
          return;
        }
        hasReceivedProductPayload = true;
        if (!cards.length) {
          renderEmpty("No items to display.", globals);
          return;
        }
        root.className = "grid";
        root.replaceChildren(...cards.map(renderCard));
      }

      function renderEmpty(label, globals) {
        root.className = "empty";
        root.textContent = label + "\n" + JSON.stringify(buildDebug(globals || window.openai || {}), null, 2);
      }

      function renderToolResult(toolResult) { render({ toolOutput: toolResult || {} }); }

      function renderToolInput(toolInput) { render({ toolInput: toolInput || {} }); }

      function objectKeys(value) { return value && typeof value === "object" ? Object.keys(value) : []; }

      function arrayLength(value) { return Array.isArray(value) ? value.length : null; }

      function buildDebug(globals) {
        const rawOutput = globals.toolOutput || globals.structuredContent || {};
        const output = rawOutput.structuredContent || rawOutput;
        const metadata =
          globals.toolResponseMetadata || rawOutput._meta || globals._meta || {};
        const toolInput = globals.toolInput || {};
        return { hasWindowOpenAI: Boolean(window.openai), hasReceivedProductPayload,
          toolInputKeys: objectKeys(toolInput), toolOutputKeys: objectKeys(output),
          rawToolOutputKeys: objectKeys(rawOutput), metaKeys: objectKeys(metadata),
          toolInputItems: arrayLength(toolInput.items), toolOutputItems: arrayLength(output.items),
          nestedStructuredItems: arrayLength(rawOutput.structuredContent && rawOutput.structuredContent.items),
          metaCards: arrayLength(metadata.cards) };
      }

      function parseMessageData(data) {
        if (typeof data !== "string") return data;
        try { return JSON.parse(data); } catch { return null; }
      }

      function getToolResultFromMessage(message) {
        if (!message || typeof message !== "object") return null;
        if (message.structuredContent || message._meta) return message;
        if (message.method === "ui/notifications/tool-result") return (message.params && message.params.result) || message.params || null;
        return (message.params && message.params.result) || message.toolResult || message.result || null;
      }

      function getToolInputFromMessage(message) {
        return message && message.method === "ui/notifications/tool-input" ? (message.params && message.params.input) || message.params || null : null;
      }

      function renderFromOpenAi() {
        render(window.openai || {});
      }

      renderFromOpenAi();
      requestAnimationFrame(renderFromOpenAi);
      [100, 500].forEach((delay) => setTimeout(renderFromOpenAi, delay));
      window.addEventListener(
        "openai:set_globals",
        (event) => render((event.detail && event.detail.globals) || event.detail),
        { passive: true },
      );
      window.addEventListener(
        "message",
        (event) => {
          const message = parseMessageData(event.data);
          const toolResult = getToolResultFromMessage(message);
          if (toolResult) {
            renderToolResult(toolResult);
          }
          const toolInput = getToolInputFromMessage(message);
          if (toolInput) {
            renderToolInput(toolInput);
          }
        },
        { passive: true },
      );
    </script>
  </body>
</html>`;

function registerCardGridWidgetResource(server, definition) {
  const widgetMeta = buildCardGridWidgetMeta(definition.description);
  server.registerResource(
    definition.name,
    definition.uri,
    {
      title: definition.title,
      description: definition.description,
      mimeType: CARD_GRID_WIDGET_MIME_TYPE,
      _meta: widgetMeta,
    },
    async () => ({
      contents: [
        {
          uri: definition.uri,
          mimeType: CARD_GRID_WIDGET_MIME_TYPE,
          text: CARD_GRID_WIDGET_HTML,
          _meta: widgetMeta,
        },
      ],
    }),
  );
}

function registerProductGridWidgetResource(server) {
  for (const definition of CARD_GRID_WIDGET_DEFINITIONS) {
    registerCardGridWidgetResource(server, definition);
  }
}

export {
  PRODUCT_DETAIL_WIDGET_URI,
  PRODUCT_GRID_WIDGET_URI,
  WARDROBE_GRID_WIDGET_URI,
  registerProductGridWidgetResource,
};
