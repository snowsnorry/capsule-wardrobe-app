import { afterEach, expect, test, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  mkdirSync: fsMock.mkdirSync,
  writeFileSync: fsMock.writeFileSync,
}));

const {
  buildErrorLogContext,
  buildLastPromptArtifact,
  buildWardrobePayload,
  countItemsByKey,
  extractLlmUsage,
  getSelectionSummary,
  getRequiredCapsule,
  getRequestedWardrobeParams,
  getSqlRows,
  saveLastPromptArtifacts,
} = await import("./aiCommon.js");

afterEach(() => {
  vi.restoreAllMocks();
  fsMock.mkdirSync.mockClear();
  fsMock.writeFileSync.mockClear();
  delete process.env.NODE_ENV;
});

test("aiCommon summarizes selected items without retaining the raw selection", () => {
  expect(getSqlRows([{ id: 1 }])).toEqual([{ id: 1 }]);
  expect(getSqlRows({ count: 1 })).toEqual([]);
  expect(
    getSelectionSummary({ capsule: { top: ["1", "2"], shoes: ["3"] } }),
  ).toEqual({
    selectedItemsTotal: 3,
    selectedItemsByCategory: { top: 2, shoes: 1 },
  });
  expect(getSelectionSummary(null)).toEqual({
    selectedItemsTotal: 0,
    selectedItemsByCategory: {},
  });
});

test("last prompt artifacts handle non-string prompts and development writes", () => {
  expect(buildLastPromptArtifact(null as never)).toBe("");
  expect(
    buildLastPromptArtifact("Return JSON", { locale: "en", audience: "woman" }),
  ).toContain("User:\nReturn JSON");

  process.env.NODE_ENV = "test";
  saveLastPromptArtifacts("ignored");
  expect(fsMock.writeFileSync).not.toHaveBeenCalled();

  process.env.NODE_ENV = "development";
  saveLastPromptArtifacts("saved", { locale: "en" });
  expect(fsMock.mkdirSync).toHaveBeenCalledWith(expect.any(URL), {
    recursive: true,
  });
  expect(fsMock.writeFileSync).toHaveBeenCalledWith(
    expect.any(URL),
    expect.stringContaining("User:\nsaved"),
    "utf8",
  );
});

test("requested wardrobe params trim strings and filter arrays", () => {
  expect(getRequestedWardrobeParams(null)).toEqual({});
  expect(
    getRequestedWardrobeParams(
      {
        formalityLevel: " casual ",
        style: "",
        occasions: [" office ", "", 12],
        season: ["summer"],
        audience: " woman ",
        color: "blue",
        pattern: "plain",
        sourceMode: "wardrobe_preferred",
        locale: " en ",
      } as never,
      { forceRefresh: true },
    ),
  ).toEqual({
    forceRefresh: true,
    formalityLevel: "casual",
    occasions: [" office "],
    season: ["summer"],
    audience: "woman",
    color: "blue",
    pattern: "plain",
    sourceMode: "wardrobe_preferred",
    locale: "en",
  });
});

test("countItemsByKey and getRequiredCapsule handle empty keys and errors", () => {
  expect(
    countItemsByKey([
      { category: "top" },
      { category: " top " },
      { category: "" },
      { category: null },
    ] as never),
  ).toEqual({ top: 2 });
  expect(getRequiredCapsule("capsule-1", { id: "capsule-1" })).toEqual({
    id: "capsule-1",
  });
  expect(() => getRequiredCapsule("", null)).toThrow(/invalid_payload/);
  expect(() => getRequiredCapsule("capsule-1", null)).toThrow(/not_found/);
});

test("extractLlmUsage, buildErrorLogContext, and buildWardrobePayload shape optional data", () => {
  expect(extractLlmUsage(null)).toEqual({});
  expect(
    extractLlmUsage({
      input_tokens: 2,
      output_tokens: 3,
      total_tokens: Number.NaN,
      output_tokens_details: { reasoning_tokens: 1 },
    }),
  ).toEqual({
    inputTokens: 2,
    outputTokens: 3,
    reasoningTokens: 1,
  });
  expect(buildErrorLogContext(null)).toBeNull();
  expect(buildErrorLogContext({ capsuleRequestId: "req-1" })).toEqual({
    capsuleRequestId: "req-1",
  });
  expect(
    buildWardrobePayload({
      items: [{ id: "top-1" }] as never,
      outfitSets: [{ id: "set-1" }] as never,
      rawSelectionText: "raw",
      swimwearReasoning: "reason",
      swimwearRawSelectionText: "swim-raw",
    }),
  ).toEqual({
    items: [{ id: "top-1" }],
    outfitSets: [{ id: "set-1" }],
    rawSelectionText: "raw",
    swimwearReasoning: "reason",
    swimwearRawSelectionText: "swim-raw",
  });
});
