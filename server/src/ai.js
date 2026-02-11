import { getLinkPreview } from "link-preview-js";

/*
Pick 12 clothing items that coordinate to create a capsule wardrobe for a modern, chic working woman. Include both office and casual pieces. Include 2 bottoms, 2 tops, 1 outerwear item, 2 pairs of shoes, 1 belt, and 2 bags. Use only these brands' websites:
- https://www.arket.com/en-nl/
- https://www.stories.com/en-nl/
- https://www.cos.com/

Return result as valid JSON in the following format, no other information or words should be in the response:
[{
"category": <"bottom", "top", "outerwear", "shoes", "belt", "bag">,
"link": <link on a webpage with that product>
},...]

Every link MUST return a valid webpage with a product from the specified brands.
You must navigate to the live shop sections to ensure the products are currently available. Every link must be a direct product URL (not a category or search page) and must be active at the time of this query to avoid 404 errors.
The response MUST be valid JSON and parsable by standard JSON parsers. Do not include any other text outside of the JSON. 
*/

const TEMP_WARDROBE_ITEMS = [
   {
      "category": "bottom",
      "link": "https://www.arket.com/en-nl/product/wide-leg-tailored-trousers-dark-brown-1307223002/"
   },
   {
      "category": "bottom",
      "link": "https://www.cos.com/en-nl/women/womenswear/trousers/slimfit/product/elasticated-slim-leg-trousers-dark-brown-1312548001/"
   },
   {
      "category": "top",
      "link": "https://www.arket.com/en-nl/product/regular-fit-poplin-shirt-burgundy-1243051009/"
   },
   {
      "category": "top",
      "link": "https://www.stories.com/en-nl/product/mulberry-silk-buttoned-blouse-black-1001320001/"
   },
   {
      "category": "outerwear",
      "link": "https://www.cos.com/en-nl/women/womenswear/coatsjackets/coats/product/oversized-wool-workwear-coat-black-1258270001/"
   },
   {
      "category": "shoes",
      "link": "https://www.arket.com/en-nl/product/lacquered-leather-loafers-black-1317806001/"
   },
   {
      "category": "shoes",
      "link": "https://www.stories.com/en-nl/product/chunky-leather-side-zip-boots-black-1008187001/"
   },
   {
      "category": "belt",
      "link": "https://www.arket.com/en-nl/product/leather-belt-black-1200313002/"
   },
   {
      "category": "bag",
      "link": "https://www.cos.com/en-nl/women/accessories/bags/leather/product/trove-crossbody-bag-leather-black-1302042001/"
   },
   {
      "category": "bag",
      "link": "https://www.stories.com/en-nl/product/leather-tote-bag-dark-grey-1317462001/"
   },
   {
      "category": "top",
      "link": "https://www.cos.com/en-nl/women/womenswear/knitwear/cardigans/cashmere/product/brushed-cashmere-cardigan-dark-brown-1230442003/"
   },
   {
      "category": "bottom",
      "link": "https://www.stories.com/en-nl/product/ruffled-mini-skirt-lilacpinkgreen-1199051001/"
   }
];

const TEMP_WARDROBE_ITEMS2 = [
  {
    "category": "bottom",
    "link": "https://www.arket.com/en-nl/women/trousers/product/pleated-trousers-dark-blue-1268316001/?srsltid=AfmBOore4BaX7zLUG3z0jpYTuPTqVeX9W31WQzRaJjMrKtTd0dkio560"
  },
  {
    "category": "bottom",
    "link": "https://www.arket.com/en-nl/women/knitwear/product/slim-trousers-grey-melange-1246757001/?srsltid=AfmBOoqMduI6qleC05QBeaJJqQIp3fcldcNGw5HU8JjoynsWdlA13js5"
  },
  {
    "category": "top",
    "link": "https://www.arket.com/en-nl/women/tops/longsleeve/product/long-sleeved-merino-top-black-0630664001/?srsltid=AfmBOorEKLSoX1zuvxEtfZVQz-AZF7IhV6nllMvH-SIbvFBiUNtVTFEC"
  },
  {
    "category": "top",
    "link": "https://www.cos.com/en-gb/women/womenswear/shirts/collarlesshirts/product/grandad-collar-cotton-shirt-navy-1313114001"
  },
  {
    "category": "outerwear",
    "link": "https://www.arket.com/en-nl/women/coats-and-jackets/product/oversized-wool-blend-coat-16929/"
  },
  {
    "category": "shoes",
    "link": "https://www.stories.com/en-nl/shoes/loafers/penny-loafers-1312345001"
  },
  {
    "category": "shoes",
    "link": "https://www.stories.com/en-nl/shoes/sneakers/adidas-handball-spezial-sneakers-1323456002"
  },
  {
    "category": "belt",
    "link": "https://www.arket.com/en-nl/women/accessories/belts/product/classic-leather-belt-black-1433567001/"
  },
  {
    "category": "bag",
    "link": "https://www.arket.com/en-nl/women/bags/crossbody-bags/product/small-leather-crossbody-bag-black-1765432001/"
  },
  {
    "category": "bag",
    "link": "https://www.cos.com/en-eu/women/womenswear/bags/product/leather-tote-bag-black-1382746002"
  }
];
const TEMP_WARDROBE_ITEMS1 = 
[
  {
    "category": "bottom",
    "link": "https://www.arket.com/en-nl/product/elastic-waist-tailored-trousers-black-1300382003/"
  },
  {
    "category": "bottom",
    "link": "https://www.arket.com/en-nl/product/pleated-wool-blend-skirt-dark-grey-1246489003/"
  },
  {
    "category": "top",
    "link": "https://www.arket.com/en-nl/women/knitwear/crewneck/product/merino-jumper-dark-grey-1259865001/"
  },
  {
    "category": "top",
    "link": "https://www.arket.com/en-nl/women/knitwear/crewneck/product/knitted-merino-wool-t-shirt-light-beige-1236180005/"
  },
  {
    "category": "top",
    "link": "https://www.stories.com/en-nl/product/stand-collar-silk-blouse-greenwhite-stripes-1330524001/"
  },
  {
    "category": "top",
    "link": "https://www.arket.com/en-nl/product/merino-wool-jumper-dark-brown-1246216001/"
  },
  {
    "category": "outerwear",
    "link": "https://www.arket.com/en-nl/product/wool-alpaca-blend-coat-black-1300194001/"
  },
  {
    "category": "outerwear",
    "link": "https://www.arket.com/en-nl/product/relaxed-blazer-black-1306503001/"
  },
  {
    "category": "shoes",
    "link": "https://www.arket.com/en-nl/product/chunky-leather-ankle-boots-black-1306659001/"
  },
  {
    "category": "shoes",
    "link": "https://www.arket.com/en-nl/product/leather-loafers-black-1246894001/"
  },
  {
    "category": "belt",
    "link": "https://www.stories.com/en-nl/product/leather-belt-mole-1223959011/"
  },
  {
    "category": "bag",
    "link": "https://www.cos.com/en-nl/women/accessories/bags/totebags/product/pinch-tote-bag-linen-beige-1289041001"
  },
  {
    "category": "bag",
    "link": "https://www.stories.com/en-nl/product/leather-crossbody-bag-dusty-blue-1333375002/"
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
          followRedirects: `manual`,
          handleRedirects: (baseURL, forwardedURL) => {
            const urlObj = new URL(baseURL);
            const forwardedURLObj = new URL(forwardedURL);
            if (
              forwardedURLObj.hostname === urlObj.hostname ||
              forwardedURLObj.hostname === "www." + urlObj.hostname ||
              "www." + forwardedURLObj.hostname === urlObj.hostname
            ) {
              return true;
            } else {
              return false;
            }
          },
          timeout: 3000
        });
        if (!data 
          || typeof data !== "object" 
          || Object.keys(data).length === 0 
          || !data.title 
          || data.title.indexOf('404') !== -1 
          || !data.images 
          || data.images.length === 0) {
          return null;
        }
        return { ...item, data };
      } catch (error) {
        console.log(error)
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
