import { getLinkPreview } from "link-preview-js";

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
          timeout: 1000
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
