import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import type { SearchResultItem } from "./searchTypes";

function markSearchResultLikeState(
  items: SearchResultItem[],
  item: SearchResultItem,
  isLiked: boolean,
) {
  const itemUrl = getCanonicalItemUrl(item);
  return itemUrl ? patchLikedStateByUrl(items, itemUrl, isLiked) : items;
}

export { markSearchResultLikeState };
