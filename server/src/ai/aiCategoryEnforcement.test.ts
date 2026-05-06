import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceCategoryCounts,
  getSelectedIdsFromCapsule
} from "./aiCategoryEnforcement.js";

test("getSelectedIdsFromCapsule flattens only non-empty ids from capsule object", () => {
  assert.deepEqual(
    getSelectedIdsFromCapsule({
      top: ["1", "2", ""],
      bottom: ["3"],
      bag: null,
      misc: "nope"
    }),
    ["1", "2", "3"]
  );
});

test("enforceCategoryCounts limits style-matched additions to four when alternatives exist", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["minimalistic"] },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"] }
    ],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-2", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-3", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-4", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "top-5", category: "top", style: ["classic"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-3", category: "bottom", style: ["classic"], is_neutral: true }
    ],
    {
      top: 3,
      bottom: 2
    },
    {
      style: "minimalistic"
    }
  );

  assert.equal(balancedItems.length, 5);
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.style) && item.style.includes("minimalistic")).length,
    4
  );
  assert.ok(
    balancedItems.some((item) => !Array.isArray(item.style) || !item.style.includes("minimalistic"))
  );
});

test("enforceCategoryCounts limits accent color additions to three and then prefers neutral items", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-3", category: "top", color_base: ["navy"], is_neutral: true },
      { id: "bottom-1", category: "bottom", color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    },
    {
      color: "red"
    }
  );

  assert.equal(balancedItems.length, 4);
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.color_base) && item.color_base.includes("red")).length,
    3
  );
  assert.ok(
    balancedItems.some((item) => !Array.isArray(item.color_base) || !item.color_base.includes("red"))
  );
  assert.ok(balancedItems.every((item) => (
    (Array.isArray(item.color_base) && item.color_base.includes("red")) || item.is_neutral === true
  )));
});

test("enforceCategoryCounts spreads accent color items across categories before reusing the same category", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-3", category: "top", color_base: ["black"], is_neutral: true },
      { id: "bottom-1", category: "bottom", color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", color_base: ["navy"], is_neutral: true },
      { id: "shoe-1", category: "shoe", color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    },
    {
      color: "red"
    }
  );

  const redByCategory = balancedItems.reduce((result, item) => {
    if (Array.isArray(item.color_base) && item.color_base.includes("red")) {
      result[item.category] = (result[item.category] || 0) + 1;
    }
    return result;
  }, {});

  assert.equal(redByCategory.top, 1);
  assert.equal(redByCategory.bottom, 1);
  assert.equal(redByCategory.shoe, 1);
  assert.ok(balancedItems.some((item) => item.id === "top-3"));
});

test("enforceCategoryCounts counts preselected items toward style and color limits", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false }
    ],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-3", category: "bottom", style: ["classic"], color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "shoe-2", category: "shoe", style: ["classic"], color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 2,
      shoe: 1
    },
    {
      style: "minimalistic",
      color: "red"
    }
  );

  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.style) && item.style.includes("minimalistic")).length,
    3
  );
  assert.equal(
    balancedItems.filter((item) => Array.isArray(item.color_base) && item.color_base.includes("red")).length,
    3
  );
  assert.ok(balancedItems.some((item) => item.id === "bottom-3"));
  assert.ok(balancedItems.some((item) => item.id === "shoe-2"));
});

test("enforceCategoryCounts keeps only one target pattern item and prefers solid or null for the rest", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "Floral", is_neutral: true },
      { id: "top-2", category: "top", pattern: "solid", is_neutral: true },
      { id: "bottom-1", category: "bottom", pattern: "floral", is_neutral: true },
      { id: "bottom-2", category: "bottom", pattern: null, is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1
    },
    {
      pattern: "floral"
    }
  );

  assert.equal(
    balancedItems.filter((item) => String(item.pattern || "").toLowerCase() === "floral").length,
    1
  );
  assert.ok(
    balancedItems.every((item) => (
      String(item.pattern || "").toLowerCase() === "floral"
      || item.pattern === null
      || String(item.pattern).toLowerCase() === "solid"
    ))
  );
});

test("enforceCategoryCounts falls back when only target pattern items are available", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "plaid" },
      { id: "top-2", category: "top", pattern: "plaid" }
    ],
    {
      top: 2
    },
    {
      pattern: "plaid"
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});

test("enforceCategoryCounts falls back to violating constraints when needed to fill category quotas", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", color_base: ["red"], is_neutral: false }
    ],
    {
      top: 2
    },
    {
      color: "red"
    }
  );

  assert.equal(balancedItems.length, 2);
  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});

test("enforceCategoryCounts keeps no-accent mode neutral unless fallback is required", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "top-2", category: "top", style: ["minimalistic"], color_base: ["blue"], is_neutral: false },
      { id: "top-3", category: "top", style: ["minimalistic"], color_base: ["navy"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["red"], is_neutral: false },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], color_base: ["black"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["minimalistic"], color_base: ["camel"], is_neutral: false },
      { id: "shoe-2", category: "shoe", style: ["minimalistic"], color_base: ["white"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    }
  );

  assert.equal(balancedItems.filter((item) => item.is_neutral === true).length, 3);
  assert.ok(balancedItems.some((item) => item.id === "top-3"));
  assert.ok(balancedItems.some((item) => item.id === "bottom-2"));
  assert.ok(balancedItems.some((item) => item.id === "shoe-2"));
  assert.ok(balancedItems.some((item) => item.is_neutral !== true));
});

test("enforceCategoryCounts keeps solid-only mode free of prints unless fallback is required", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", pattern: "Floral", is_neutral: true },
      { id: "top-2", category: "top", pattern: "solid", is_neutral: true },
      { id: "bottom-1", category: "bottom", pattern: "stripe", is_neutral: true },
      { id: "bottom-2", category: "bottom", pattern: null, is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1
    }
  );

  assert.equal(
    balancedItems.filter((item) => {
      const normalizedPattern = String(item.pattern || "").toLowerCase();
      return normalizedPattern !== "" && normalizedPattern !== "solid";
    }).length,
    1
  );
  assert.ok(
    balancedItems.some((item) => item.pattern === null || String(item.pattern).toLowerCase() === "solid")
  );
});

test("enforceCategoryCounts infers style from first non-minimalistic item and still allows minimalistic items", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["sporty"], is_neutral: true },
      { id: "top-2", category: "top", style: ["minimalistic"], is_neutral: true },
      { id: "bottom-1", category: "bottom", style: ["classic"], is_neutral: true },
      { id: "bottom-2", category: "bottom", style: ["minimalistic"], is_neutral: true },
      { id: "shoe-1", category: "shoe", style: ["sporty"], is_neutral: true },
      { id: "shoe-2", category: "shoe", style: ["minimalistic"], is_neutral: true }
    ],
    {
      top: 2,
      bottom: 1,
      shoe: 1
    }
  );

  assert.ok(balancedItems.some((item) => item.id === "top-1"));
  assert.ok(balancedItems.some((item) => item.id === "top-2"));
  assert.ok(balancedItems.some((item) => item.id === "bottom-2"));
  assert.ok(
    balancedItems.every((item) => {
      const styles = Array.isArray(item.style) ? item.style : [];
      return styles.includes("sporty") || styles.includes("minimalistic");
    })
  );
});

test("enforceCategoryCounts infers constraints from preselected items before filling categories", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "stripe" }
    ],
    [
      { id: "top-1", category: "top", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "stripe" },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"], color_base: ["black"], is_neutral: true, pattern: "solid" },
      { id: "bottom-2", category: "bottom", style: ["classic"], color_base: ["blue"], is_neutral: false, pattern: "floral" },
      { id: "shoe-1", category: "shoe", style: ["sporty"], color_base: ["red"], is_neutral: false, pattern: "solid" },
      { id: "shoe-2", category: "shoe", style: ["classic"], color_base: ["blue"], is_neutral: false, pattern: "check" }
    ],
    {
      top: 1,
      bottom: 1,
      shoe: 1
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "bottom-1", "shoe-1"]
  );
});

test("enforceCategoryCounts infers mixed style targets from the first non-minimalistic style", () => {
  const balancedItems = enforceCategoryCounts(
    [],
    [
      { id: "top-1", category: "top", style: ["minimalistic", "sporty"] },
      { id: "top-2", category: "top", style: ["minimalistic", "classic"] },
      { id: "bottom-1", category: "bottom", style: ["minimalistic"] },
      { id: "shoe-1", category: "shoe", style: ["sporty"] }
    ],
    {
      top: 1,
      bottom: 1,
      shoe: 1
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "bottom-1", "shoe-1"]
  );
});

test("enforceCategoryCounts preserves unique ids when selected and candidate pools overlap", () => {
  const balancedItems = enforceCategoryCounts(
    [
      { id: "top-1", category: "top" }
    ],
    [
      { id: "top-1", category: "top" },
      { id: "top-1", category: "top" },
      { id: "top-2", category: "top" }
    ],
    {
      top: 2
    }
  );

  assert.deepEqual(
    balancedItems.map((item) => item.id),
    ["top-1", "top-2"]
  );
});
