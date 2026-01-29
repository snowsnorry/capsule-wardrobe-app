import { getLinkPreview } from "link-preview-js";

const TEMP_WARDROBE_ITEMS = [
  {
    category: "bottom",
    label: "Wide-Leg Tailored Trousers",
    link: "https://www.arket.com/en-nl/product/wide-leg-tailored-trousers-dark-brown-1307223002/"
  },
  {
    category: "bottom",
    label: "Elasticated Slim-Leg Trousers",
    link: "https://www.cos.com/en-nl/women/womenswear/trousers/slimfit/product/elasticated-slim-leg-trousers-dark-brown-1312548001/"
  },
  {
    category: "top",
    label: "Regular-Fit Poplin Shirt",
    link: "https://www.arket.com/en-nl/product/regular-fit-poplin-shirt-burgundy-1243051009/"
  },
  {
    category: "top",
    label: "Mulberry Silk Buttoned Blouse",
    link: "https://www.stories.com/en-nl/product/mulberry-silk-buttoned-blouse-black-1001320001/"
  },
  {
    category: "outerwear",
    label: "Oversized Wool Workwear Coat",
    link: "https://www.cos.com/en-nl/women/womenswear/coatsjackets/coats/product/oversized-wool-workwear-coat-black-1258270001/"
  },
  {
    category: "shoes",
    label: "Lacquered Leather Loafers",
    link: "https://www.arket.com/en-nl/product/lacquered-leather-loafers-black-1317806001/"
  },
  {
    category: "shoes",
    label: "Chunky Leather Side Zip Boots",
    link: "https://www.stories.com/en-nl/product/chunky-leather-side-zip-boots-black-1008187001/"
  },
  {
    category: "belt",
    label: "Leather Belt",
    link: "https://www.arket.com/en-nl/product/leather-belt-black-1200313002/"
  },
  {
    category: "bag",
    label: "Trove Crossbody Bag",
    link: "https://www.cos.com/en-nl/women/accessories/bags/leather/product/trove-crossbody-bag-leather-black-1302042001/"
  },
  {
    category: "bag",
    label: "Leather Tote Bag",
    link: "https://www.stories.com/en-nl/product/leather-tote-bag-dark-grey-1317462001/"
  },
  {
    category: "top",
    label: "Brushed-Cashmere Cardigan",
    link: "https://www.cos.com/en-nl/women/womenswear/knitwear/cardigans/cashmere/product/brushed-cashmere-cardigan-dark-brown-1230442003/"
  },
  {
    category: "bottom",
    label: "Ruffled Mini Skirt",
    link: "https://www.stories.com/en-nl/product/ruffled-mini-skirt-lilacpinkgreen-1199051001/"
  }
];

async function callWardrobeAi() {
  return TEMP_WARDROBE_ITEMS;
}

async function prefetchLinksData(items) {
  const processed = await Promise.all(
    items.map(async (item) => {
      if (!item.link) {
        return null;
      }
      try {
        const data = await getLinkPreview(item.link, {
          imagesPropertyType: "og", // fetches only open-graph images
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          },
          timeout: 1000
        });
        if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
          return null;
        }
        return { ...item, data };
      } catch (error) {
        return null;
      }
    })
  );
  return processed.filter(Boolean);
}

async function getWardrobeItems(req, res) {
  const items = await callWardrobeAi();
  const processedItems = await prefetchLinksData(items);
  res.json({ ok: true, items: processedItems });
}

export { getWardrobeItems };
