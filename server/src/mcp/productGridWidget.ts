const PRODUCT_GRID_WIDGET_URI = "ui://capsule/product-grid.html";
const PRODUCT_GRID_WIDGET_META = {
  ui: {
    prefersBorder: true,
    csp: {
      connectDomains: [],
      resourceDomains: ["https://assets.capsule-wardrobe.org"],
    },
  },
  "openai/widgetDescription":
    "A responsive product grid with images, prices, badges, and product links.",
  "openai/widgetPrefersBorder": true,
  "openai/widgetCSP": {
    connect_domains: [],
    resource_domains: ["https://assets.capsule-wardrobe.org"],
    redirect_domains: ["https://www.stories.com", "https://example.com"],
  },
};
const PRODUCT_GRID_WIDGET_HTML = String.raw`<!doctype html>
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

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(164px, 1fr));
        gap: 12px;
        padding: 2px;
      }

      .card {
        overflow: hidden;
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, Canvas 94%, CanvasText 6%);
        text-decoration: none;
        color: inherit;
      }

      .image {
        width: 100%;
        aspect-ratio: 4 / 5;
        object-fit: cover;
        display: block;
        background: color-mix(in srgb, CanvasText 8%, transparent);
      }

      .body {
        display: grid;
        gap: 7px;
        padding: 10px;
      }

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

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .badge {
        border-radius: 999px;
        background: color-mix(in srgb, CanvasText 9%, transparent);
        padding: 3px 7px;
        font-size: 11px;
        line-height: 1;
      }

      .empty {
        padding: 16px;
        color: color-mix(in srgb, CanvasText 68%, transparent);
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main id="root" class="empty">No products to display.</main>
    <script>
      const openai = window.openai || {};
      const output = openai.toolOutput || {};
      const metadata = openai.toolResponseMetadata || {};
      const cards = Array.isArray(metadata.cards)
        ? metadata.cards
        : buildCardsFromItems(output.items);
      const root = document.getElementById("root");

      function buildCardsFromItems(items) {
        return Array.isArray(items)
          ? items.map((item) => ({
              type: "product_card",
              itemId: item.id,
              title: item.name,
              subtitle: [item.brand, item.price && item.price.display]
                .filter(Boolean)
                .join(" - "),
              image: item.image,
              badges: [
                item.attributes && item.attributes.isSavedToWardrobe
                  ? "Saved"
                  : null,
                item.category,
                item.availability,
              ].filter(Boolean),
              primaryAction:
                typeof item.url === "string"
                  ? {
                      type: "open_external",
                      label: "Open product",
                      url: item.url,
                    }
                  : null,
            }))
          : [];
      }

      function openCard(event, url) {
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

      if (cards.length) {
        root.className = "grid";
        root.replaceChildren(...cards.map(renderCard));
      }
    </script>
  </body>
</html>`;

function registerProductGridWidgetResource(server) {
  server.registerResource(
    "product_grid_widget",
    PRODUCT_GRID_WIDGET_URI,
    {
      title: "Product grid",
      description: "Renders product search results as image cards.",
      mimeType: "text/html",
      _meta: PRODUCT_GRID_WIDGET_META,
    },
    async () => ({
      contents: [
        {
          uri: PRODUCT_GRID_WIDGET_URI,
          mimeType: "text/html",
          text: PRODUCT_GRID_WIDGET_HTML,
          _meta: PRODUCT_GRID_WIDGET_META,
        },
      ],
    }),
  );
}

export { PRODUCT_GRID_WIDGET_URI, registerProductGridWidgetResource };
