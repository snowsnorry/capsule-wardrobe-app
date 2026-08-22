import { expect, test } from "vitest";
import { createSearchState } from "../../search/searchState";
import { serializeStatisticsState } from "./statisticsState";

test("serializeStatisticsState omits the Explore-only exact color", () => {
  const priceRange = { min: 10, max: 100 };
  const state = createSearchState({ exactColor: "#aabbcc" }, priceRange);

  expect(serializeStatisticsState(state, priceRange)).not.toHaveProperty(
    "exactColor",
  );
});
