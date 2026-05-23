import {
  CLIENT_ORIGIN,
  MCP_OAUTH_ISSUER,
  THUMBNAIL_ASSET_BASE_URL,
} from "../appConfig.js";

const PRODUCT_GRID_WIDGET_URI = "ui://capsule/product-grid.v4.html";
const PRODUCT_DETAIL_WIDGET_URI = "ui://capsule/product-detail.v4.html";
const WARDROBE_GRID_WIDGET_URI = "ui://capsule/wardrobe-grid.v4.html";
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

function resolveWidgetDomain() {
  return (
    normalizeHttpOrigin(process.env.CLIENT_ORIGIN) ||
    normalizeHttpOrigin(MCP_OAUTH_ISSUER) ||
    normalizeHttpOrigin(CLIENT_ORIGIN)
  );
}

function getResourceDomains() {
  return uniqueStrings([
    normalizeHttpOrigin(THUMBNAIL_ASSET_BASE_URL),
    DEFAULT_ASSET_ORIGIN,
  ]);
}

function buildCardGridWidgetMeta(description: string) {
  const domain = resolveWidgetDomain();
  const resourceDomains = getResourceDomains();
  const ui = {
    prefersBorder: true,
    ...(domain ? { domain } : {}),
    csp: {
      connectDomains: [],
      resourceDomains,
    },
  };

  return {
    ui,
    "openai/widgetDescription": description,
    "openai/widgetPrefersBorder": true,
    ...(domain ? { "openai/widgetDomain": domain } : {}),
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: resourceDomains,
      redirect_domains: [
        "https://www.stories.com",
        "https://example.com",
        ...(domain ? [domain] : []),
      ],
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

      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(164px, 1fr)); gap: 12px; padding: 2px; }

      .card {
        overflow: hidden;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, Canvas 94%, CanvasText 6%);
        text-decoration: none;
        color: inherit;
      }

      .image { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; background: color-mix(in srgb, CanvasText 8%, transparent); }

      .body { display: grid; gap: 7px; padding: 10px; }

      .title {
        font-size: 13px;
        font-weight: 650;
        line-height: 1.25;
      }

      .subtitle {
        min-height: 16px;
        color: color-mix(in srgb, CanvasText 68%, transparent);
        font-size: 12px;
        line-height: 1.3;
      }

      .badges { display: flex; flex-wrap: wrap; gap: 5px; }

      .badge {
        border-radius: 999px;
        background: color-mix(in srgb, CanvasText 9%, transparent);
        padding: 3px 7px;
        font-size: 11px;
        line-height: 1;
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
                item.attributes && item.attributes.isSavedToWardrobe ? "Saved" : null,
                item.category,
                item.availability,
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
        for (const label of Array.isArray(card.badges) ? card.badges : []) {
          const badge = document.createElement("span");
          badge.className = "badge";
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
  resolveWidgetDomain,
};
