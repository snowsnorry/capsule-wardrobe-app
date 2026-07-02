import { test, expect, afterEach } from "vitest";
import {
  setSqlClientOverride,
  checkDatabaseConnection,
  upsertLoginCode,
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  getSearchByEmail,
  upsertSearchByEmail,
  searchProducts,
  searchProductStats,
  createProfileRecord,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
  deleteProfileByEmail,
  deleteUploadedWardrobeItemById,
  deleteWardrobeItemFromCatalogByUrl,
  getUploadedWardrobeItemById,
  listWardrobeItemsByIdsForEmail,
  listWardrobeItemsByUrlsForEmail,
  listWardrobeItemsByEmail,
  listUploadedWardrobeR2KeysByEmail,
  saveUploadedWardrobeItemsByEmail,
  saveWardrobeItemFromCatalogByUrl,
  updateUploadedWardrobeItemDetailsById,
  updateUploadedWardrobeItemMetadataById,
} from "./db.js";

type SqlCall = {
  strings: string[];
  values: unknown[];
  text: string;
};

type SqlCallContext = SqlCall & {
  calls: SqlCall[];
};

type SqlResultValue = unknown[] | { count: number };
type SqlResultHandler =
  SqlResultValue | ((context: SqlCallContext) => SqlResultValue);

type DatabaseConnectionRow = {
  database: string;
  now: string | Date;
};

type LoginCodeRow = {
  email: string;
  codeHash: string;
  nonce: string;
  expiresAt: Date | string;
  attempts: number;
  consumedAt: Date | string | null;
};

type SessionRow = {
  sessionId: string;
  email: string;
  csrfToken: string;
  createdAt: Date | string;
  expiresAt: Date | string;
};

type SearchRow = {
  email: string;
  query: string | null;
  embedding: number[] | null;
  likedOnly: boolean | null;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
};

type CountRow = {
  total: number;
};

type ProductSearchRow = {
  id: string;
  name: string;
  brand: string | null;
  distance?: number;
};

type WardrobeRow = {
  id: string;
  profileEmail: string;
  productId: string | null;
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  source: string;
  rawImageUrl: string | null;
  processingStatus: string;
  isNeutral?: boolean | null;
  createdAt: string;
  updatedAt: string;
};

type ProfileRow = {
  email: string;
  activeCapsuleId?: string | null;
  locale: string;
  fullname?: string | null;
  theme?: string | null;
  llm?: string | null;
  imageLlm?: string | null;
};

function createSqlMock(handlers: SqlResultHandler[]) {
  const calls: SqlCall[] = [];

  function takeHandler(text: string): SqlResultHandler | undefined {
    if (/count\(\*\)::integer/i.test(text)) {
      const index = handlers.findIndex(isCountRowsHandler);
      if (index >= 0) {
        return handlers.splice(index, 1)[0];
      }
    }

    if (/result_limit/i.test(text)) {
      const index = handlers.findIndex(
        (handler) => !isCountRowsHandler(handler),
      );
      if (index >= 0) {
        return handlers.splice(index, 1)[0];
      }
    }

    return handlers.shift();
  }

  async function runSqlCall<TRow = unknown>({
    strings,
    values,
    text,
  }: SqlCall): Promise<TRow[] | { count: number }> {
    calls.push({ strings, values, text });
    const handler = takeHandler(text);
    if (!handler) {
      throw new Error(`Unexpected SQL call: ${text}`);
    }
    if (typeof handler === "function") {
      return handler({ strings, values, text, calls }) as
        TRow[] | { count: number };
    }
    return handler as TRow[] | { count: number };
  }

  const query = async <TRow = unknown>(
    queryText: string,
    values: readonly unknown[] = [],
  ): Promise<TRow[] | { count: number }> =>
    runSqlCall({
      strings: [queryText],
      values: [...values],
      text: queryText,
    });

  async function sql<TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow[] | { count: number }> {
    const text = strings.join(" ");
    return runSqlCall({ strings: [...strings], values, text });
  }
  return { sql: Object.assign(sql, { query }), calls };
}

function isCountRowsHandler(handler: SqlResultHandler): boolean {
  return (
    Array.isArray(handler) &&
    Boolean(handler[0]) &&
    typeof handler[0] === "object" &&
    "total" in handler[0]
  );
}

function findSqlCall(calls: SqlCall[], pattern: RegExp): SqlCall {
  const call = calls.find(({ text }) => pattern.test(text));
  expect(call).toBeDefined();
  return call as SqlCall;
}

function getReturningProjection(text: string): string {
  const index = text.toLowerCase().lastIndexOf("returning");
  expect(index).toBeGreaterThanOrEqual(0);
  return text.slice(index);
}

function expectNoEmbeddingInReturning(call: SqlCall) {
  expect(getReturningProjection(call.text)).not.toMatch(/\bembedding\b/i);
}

afterEach(() => {
  setSqlClientOverride(null);
});

test("db integration shapes login code persistence and verification queries", async () => {
  const expiresAt = new Date("2026-03-29T10:15:00.000Z");
  const { sql, calls } = createSqlMock([
    [],
    [
      {
        email: "user@example.com",
        codeHash: "hash-1",
        nonce: "nonce-1",
        expiresAt,
        attempts: 0,
        consumedAt: null,
      },
    ] satisfies LoginCodeRow[],
    [],
    [{ attempts: 3 }],
    [
      {
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 3,
      },
    ],
  ]);
  setSqlClientOverride(sql);

  await upsertLoginCode({
    email: "user@example.com",
    codeHash: "hash-1",
    nonce: "nonce-1",
    expiresAt,
  });
  const stored = await getLoginCodeByEmail("user@example.com");
  const invalid = await verifyAndConsumeLoginCode({
    email: "user@example.com",
    codeHash: "wrong-hash",
    maxAttempts: 5,
  });

  expect(stored?.email).toBe("user@example.com");
  expect(invalid).toEqual({ ok: false, reason: "invalid" });

  expect(calls[0].text).toMatch(/insert into login_codes/i);
  expect(calls[0].values).toEqual([
    "user@example.com",
    "hash-1",
    "nonce-1",
    expiresAt,
  ]);
  expect(calls[1].text).toMatch(/code_hash as "codeHash"/i);
  expect(calls[1].values).toEqual(["user@example.com"]);
  expect(calls[2].text).toMatch(
    /update login_codes\s+set consumed_at = now\(\)/i,
  );
  expect(calls[2].values).toEqual(["user@example.com", 5, "wrong-hash"]);
  expect(calls[3].text).toMatch(/set attempts = attempts \+ 1/i);
  expect(calls[3].values).toEqual(["user@example.com", 5, "wrong-hash"]);
  expect(calls.length).toBe(4);
});

test("db integration shapes session persistence queries", async () => {
  const createdAt = new Date("2026-03-29T10:00:00.000Z");
  const expiresAt = new Date("2026-04-05T10:00:00.000Z");
  const { sql, calls } = createSqlMock([
    [],
    [
      {
        sessionId: "sess-1",
        email: "user@example.com",
        csrfToken: "csrf-1",
        createdAt,
        expiresAt,
      },
    ] satisfies SessionRow[],
    [],
  ]);
  setSqlClientOverride(sql);

  await insertSession({
    sessionId: "sess-1",
    email: "user@example.com",
    csrfToken: "csrf-1",
    createdAt,
    expiresAt,
  });
  const session = await getSessionById("sess-1");
  await deleteSessionById("sess-1");

  expect(session?.sessionId).toBe("sess-1");
  expect(calls[0].text).toMatch(/insert into user_sessions/i);
  expect(calls[0].values).toEqual([
    "sess-1",
    "user@example.com",
    "csrf-1",
    createdAt,
    expiresAt,
  ]);
  expect(calls[1].text).toMatch(/from user_sessions/i);
  expect(calls[1].values).toEqual(["sess-1"]);
  expect(calls[2].text).toMatch(
    /delete from user_sessions where session_id =/i,
  );
  expect(calls[2].values).toEqual(["sess-1"]);
});

test("db integration shapes search persistence and searchProducts queries", async () => {
  const { sql, calls } = createSqlMock([
    [
      {
        email: "user@example.com",
        query: "linen shirt",
        embedding: [0.1, 0.2],
        likedOnly: false,
        brand: ["uniqlo"],
        priceMin: 10,
        priceMax: 90,
        audience: ["man"],
        category: ["shirt"],
        season: ["summer"],
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        color: ["navy"],
        pattern: ["solid"],
        silhouette: ["straight"],
        fit: ["regular"],
        closureType: ["button"],
        page: 2,
      },
    ] satisfies SearchRow[],
    [
      {
        email: "user@example.com",
        query: "linen shirt",
        embedding: [0.1, 0.2],
        likedOnly: false,
        brand: ["uniqlo"],
        priceMin: 10,
        priceMax: 90,
        audience: ["man"],
        category: ["shirt"],
        season: ["summer"],
        formalityLevel: ["casual"],
        style: ["minimalistic"],
        occasions: ["office"],
        color: ["navy"],
        pattern: ["solid"],
        silhouette: ["straight"],
        fit: ["regular"],
        closureType: ["button"],
        page: 2,
      },
    ] satisfies SearchRow[],
    [{ total: 1 }] satisfies CountRow[],
    [
      {
        id: "prod-1",
        name: "Linen Shirt",
        brand: "Uniqlo",
        distance: 0.12,
      },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  const saved = await getSearchByEmail("user@example.com");
  const upserted = await upsertSearchByEmail({
    email: "user@example.com",
    query: "linen shirt",
    embedding: [0.1, 0.2],
    likedOnly: false,
    brand: ["uniqlo"],
    priceMin: 10,
    priceMax: 90,
    audience: ["man"],
    category: ["shirt"],
    season: ["summer"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    occasions: ["office"],
    color: ["navy"],
    pattern: ["solid"],
    silhouette: ["straight"],
    fit: ["regular"],
    closureType: ["button"],
    page: 2,
  });
  const results = await searchProducts({
    queryEmbedding: [0.1, 0.2],
    semanticDistanceThreshold: 0.35,
    brand: ["uniqlo"],
    priceMin: 10,
    priceMax: 90,
    audience: ["man"],
    category: ["shirt"],
    season: ["summer"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    occasions: ["office"],
    color: ["navy"],
    pattern: ["solid"],
    silhouette: ["straight"],
    fit: ["regular"],
    closureType: ["button"],
    page: 2,
  });

  expect(saved?.email).toBe("user@example.com");
  expect(upserted?.page).toBe(2);
  expect(results.total).toBe(1);
  expect(results.page).toBe(2);
  expect(results.pageSize).toBe(50);
  expect(results.items[0]?.id).toBe("prod-1");
  const countCall = findSqlCall(calls, /count\(\*\)::integer/i);
  const itemCall = findSqlCall(calls, /result_limit/i);

  expect(calls[0].text).toMatch(/from search\s+where email =/i);
  expect(calls[0].values).toEqual(["user@example.com"]);
  expect(calls[1].text).toMatch(/insert into search/i);
  expect(calls[1].values[0]).toBe("user@example.com");
  expect(calls[1].values[2]).toBe(JSON.stringify([0.1, 0.2]));
  expect(countCall.text).toMatch(
    /select count\(\*\)::integer as total\s+from filtered_products/i,
  );
  expect(countCall.values.some((value) => Array.isArray(value))).toBe(true);
  expect(countCall.values.some((value) => value === "[0.1,0.2]")).toBe(true);
  expect(countCall.values.some((value) => value === 0.35)).toBe(true);
  expect(countCall.values).toContain("semantic");
  expect(itemCall.text).toMatch(
    /case[\s\S]*embedding::vector\(1024\) <=>[\s\S]*as distance/i,
  );
  expect(itemCall.text).toContain("products.season && params.season");
  expect(itemCall.values.filter((value) => value === 50).length >= 2).toBe(
    true,
  );
});

test("db integration filters searchProducts by URL prefix", async () => {
  const { sql, calls } = createSqlMock([
    [{ total: 1 }] satisfies CountRow[],
    [
      { id: "prod-1", name: "Linen Shirt", brand: "UNIQLO" },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  const results = await searchProducts({
    urlPrefix: "https://example.com/products/linen",
    page: 1,
  });

  expect(results.total).toBe(1);
  expect(results.items[0]?.id).toBe("prod-1");
  const countCall = findSqlCall(calls, /count\(\*\)::integer/i);
  const itemCall = findSqlCall(calls, /result_limit/i);

  expect(countCall.text).toMatch(/products\.url\s+like/i);
  expect(itemCall.text).toMatch(/products\.url\s+like/i);
  expect(
    countCall.values.some(
      (value) => value === "https://example.com/products/linen%",
    ),
  ).toBe(true);
  expect(
    itemCall.values.some(
      (value) => value === "https://example.com/products/linen%",
    ),
  ).toBe(true);
});

test("db integration applies lexical text search across product text fields with hard filters", async () => {
  const { sql, calls } = createSqlMock([
    [{ total: 1 }] satisfies CountRow[],
    [
      { id: "prod-1", name: "Red Dress", brand: "COS" },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  const results = await searchProducts({
    textQuery: "red",
    textSearchMode: "lexical",
    category: ["dress"],
    color: ["red"],
    page: 1,
  });

  expect(results.total).toBe(1);
  expect(results.items[0]?.id).toBe("prod-1");
  const countCall = findSqlCall(calls, /count\(\*\)::integer/i);
  const itemCall = findSqlCall(calls, /result_limit/i);

  expect(countCall.text).toMatch(
    /lower\(coalesce\(products\.name, ''\)\) like/i,
  );
  expect(countCall.text).toMatch(
    /lower\(coalesce\(products\.description, ''\)\) like/i,
  );
  expect(countCall.text).toMatch(
    /lower\(coalesce\(products\.composition, ''\)\) like/i,
  );
  expect(countCall.text).toMatch(/unnest\(coalesce\(products\.color_base/i);
  expect(countCall.text).toMatch(/lexical_score > 0/i);
  expect(countCall.text).toMatch(/cardinality\(params\.[a-z_]+\) = 0/i);
  expect(countCall.values).toContain("red");
  expect(countCall.values).toContain("red%");
  expect(countCall.values).toContain("%red%");
  expect(countCall.values).toContain("lexical");
  expect(countCall.values.some((value) => Array.isArray(value))).toBe(true);
  expect(itemCall.text).toMatch(/order by[\s\S]*lexical_score/i);
});

test("db integration escapes LIKE metacharacters in lexical text search", async () => {
  const { sql, calls } = createSqlMock([
    [{ total: 1 }] satisfies CountRow[],
    [
      { id: "prod-1", name: "100% Cotton_Bag", brand: "COS" },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  await searchProducts({
    textQuery: "100% cotton_bag~",
    textSearchMode: "lexical",
  });

  const countCall = findSqlCall(calls, /count\(\*\)::integer/i);

  expect(countCall.text).toMatch(/like[\s\S]*escape '~'/i);
  expect(countCall.values).toContain("100~% cotton~_bag~~%");
  expect(countCall.values).toContain("%100~% cotton~_bag~~%");
});

test("db integration applies hybrid rank fusion for text and semantic search", async () => {
  const { sql, calls } = createSqlMock([
    [{ total: 2 }] satisfies CountRow[],
    [
      { id: "prod-1", name: "Office Blazer", brand: "COS", distance: 0.18 },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  const results = await searchProducts({
    queryEmbedding: [0.3, 0.4],
    semanticDistanceThreshold: 0.35,
    textQuery: "office blazer for work",
    textSearchMode: "hybrid",
  });

  expect(results.total).toBe(2);
  const countCall = findSqlCall(calls, /count\(\*\)::integer/i);
  const itemCall = findSqlCall(calls, /result_limit/i);

  expect(countCall.text).toMatch(
    /lexical_score > 0[\s\S]*or[\s\S]*distance <=/i,
  );
  expect(itemCall.text).toMatch(/row_number\(\) over[\s\S]*lexical_rank/i);
  expect(itemCall.text).toMatch(/row_number\(\) over[\s\S]*semantic_rank/i);
  expect(itemCall.text).toMatch(
    /1\.0 \/ \(60 \+ matching_products\.lexical_rank\)/i,
  );
  expect(itemCall.text).toMatch(
    /1\.0 \/ \(60 \+ matching_products\.semantic_rank\)/i,
  );
  expect(countCall.values).toContain("hybrid");
  expect(countCall.values).toContain("[0.3,0.4]");
});

test("db integration applies explicit search offset and limit", async () => {
  const { sql, calls } = createSqlMock([
    [{ total: 3 }] satisfies CountRow[],
    [
      { id: "prod-2", name: "Blazer", brand: "Acme" },
    ] satisfies ProductSearchRow[],
  ]);
  setSqlClientOverride(sql);

  const results = await searchProducts({
    profileEmail: "person@example.com",
    offset: 20,
    limit: 10,
  });

  expect(results.total).toBe(3);
  expect(results.pageSize).toBe(10);
  expect(results.items[0]?.id).toBe("prod-2");
  const itemCall = findSqlCall(calls, /result_limit/i);

  expect(itemCall.values.filter((value) => value === 10).length).toBe(1);
  expect(itemCall.values.filter((value) => value === 20).length).toBe(1);
  expect(itemCall.values).toContain("person@example.com");
});

test("db integration lists and saves user wardrobe items", async () => {
  const wardrobeRow: WardrobeRow = {
    id: "wardrobe-1",
    profileEmail: "user@example.com",
    productId: "prod-1",
    name: "Linen Shirt",
    url: "https://example.com/products/linen-shirt",
    imageUrl: "https://example.com/products/linen-shirt.jpg",
    source: "from_catalog",
    rawImageUrl: null,
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([
    [wardrobeRow],
    [wardrobeRow],
    { count: 1 },
  ]);
  setSqlClientOverride(sql);

  const listed = await listWardrobeItemsByEmail({
    email: "user@example.com",
    source: "from_catalog",
  });
  const saved = await saveWardrobeItemFromCatalogByUrl({
    email: "user@example.com",
    url: "https://example.com/products/linen-shirt",
  });
  const deleted = await deleteWardrobeItemFromCatalogByUrl({
    email: "user@example.com",
    url: "https://example.com/products/linen-shirt",
  });

  expect(listed[0]).toMatchObject({
    id: "wardrobe-1",
    imageUrl: "https://example.com/products/linen-shirt.jpg",
    source: "from_catalog",
    processingStatus: "ready",
  });
  expect(saved).toMatchObject({
    id: "wardrobe-1",
    url: "https://example.com/products/linen-shirt",
    source: "from_catalog",
  });
  expect(calls[0].text).toMatch(/from wardrobe/i);
  expect(calls[0].text).not.toMatch(/\bembedding\b/i);
  expect(calls[0].values).toEqual([
    "user@example.com",
    "from_catalog",
    "from_catalog",
  ]);
  expect(calls[1].text).toMatch(/insert into wardrobe/i);
  expect(calls[1].text).toMatch(/from products/i);
  expect(calls[1].text).toMatch(/products\.id::text/i);
  expect(calls[1].text).toMatch(/products\.embedding/i);
  expect(calls[1].text).toMatch(/product_id = excluded\.product_id/i);
  expect(calls[1].text).toMatch(/embedding = excluded\.embedding/i);
  expect(calls[1].text).toMatch(/on conflict \(profile_email, url\)/i);
  expectNoEmbeddingInReturning(calls[1]);
  expect(calls[1].values[0]).toBe("user@example.com");
  expect(calls[1].values[1]).toBe("https://example.com/products/linen-shirt");
  expect(deleted).toBe(true);
  expect(calls[2].text).toMatch(/delete from wardrobe/i);
  expect(calls[2].values).toEqual([
    "user@example.com",
    "https://example.com/products/linen-shirt",
  ]);
});

test("db integration normalizes wardrobe source filters", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Uploaded shirt",
    url: "wardrobe://wardrobe-upload-1",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[uploadedRow], [uploadedRow]]);
  setSqlClientOverride(sql);

  const uploaded = await listWardrobeItemsByEmail({
    email: "user@example.com",
    source: "uploaded",
  });
  const invalidSource = await listWardrobeItemsByEmail({
    email: "user@example.com",
    source: "legacy" as never,
  });

  expect(uploaded[0]).toMatchObject({
    id: "wardrobe-upload-1",
    source: "uploaded",
  });
  expect(invalidSource[0]).toMatchObject({
    id: "wardrobe-upload-1",
    source: "uploaded",
  });
  expect(calls[0].values).toEqual(["user@example.com", "uploaded", "uploaded"]);
  expect(calls[1].values).toEqual(["user@example.com", null, null]);
});

test("db integration reads uploaded wardrobe items by id", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Uploaded shirt",
    url: "wardrobe://wardrobe-upload-1",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    isNeutral: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[uploadedRow], []]);
  setSqlClientOverride(sql);

  const blank = await getUploadedWardrobeItemById({
    email: "user@example.com",
    id: "   ",
  });
  const found = await getUploadedWardrobeItemById({
    email: "user@example.com",
    id: " wardrobe-upload-1 ",
  });
  const missing = await getUploadedWardrobeItemById({
    email: "user@example.com",
    id: "missing-upload",
  });

  expect(blank).toBeNull();
  expect(found).toMatchObject({
    id: "wardrobe-upload-1",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    isNeutral: true,
    source: "uploaded",
  });
  expect(missing).toBeNull();
  expect(calls).toHaveLength(2);
  expect(calls[0].text).toMatch(/from wardrobe/i);
  expect(calls[0].text).toMatch(/source = 'uploaded'/i);
  expect(calls[0].text).not.toMatch(/\bembedding\b/i);
  expect(calls[0].values).toEqual(["user@example.com", "wardrobe-upload-1"]);
  expect(calls[1].values).toEqual(["user@example.com", "missing-upload"]);
});

test("db integration lists wardrobe items by exact urls and source", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Uploaded shirt",
    url: "wardrobe://wardrobe-upload-1",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const catalogRow: WardrobeRow = {
    id: "wardrobe-catalog-1",
    profileEmail: "user@example.com",
    productId: "product-1",
    name: "Saved catalog shirt",
    url: "https://example.com/catalog-shirt",
    imageUrl: "https://images.example.com/catalog-shirt.webp",
    source: "from_catalog",
    rawImageUrl: null,
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[uploadedRow], [catalogRow]]);
  setSqlClientOverride(sql);

  const empty = await listWardrobeItemsByUrlsForEmail({
    email: "user@example.com",
    urls: [" "],
    source: "uploaded",
  });
  const listed = await listWardrobeItemsByUrlsForEmail({
    email: "user@example.com",
    urls: [" wardrobe://wardrobe-upload-1 "],
    source: "uploaded",
  });
  const listedCatalog = await listWardrobeItemsByUrlsForEmail({
    email: "user@example.com",
    urls: [" https://example.com/catalog-shirt "],
    source: "from_catalog",
  });

  expect(empty).toEqual([]);
  expect(listed).toEqual([
    expect.objectContaining({
      id: "wardrobe-upload-1",
      source: "uploaded",
      url: "wardrobe://wardrobe-upload-1",
    }),
  ]);
  expect(listedCatalog).toEqual([
    expect.objectContaining({
      id: "wardrobe-catalog-1",
      source: "from_catalog",
      url: "https://example.com/catalog-shirt",
    }),
  ]);
  expect(calls).toHaveLength(2);
  expect(calls[0].text).toMatch(/from unnest/i);
  expect(calls[0].text).toMatch(/'wardrobe:\/\/' \|\| wardrobe\.id::text/i);
  expect(calls[0].text).toMatch(/wardrobe\.source =/i);
  expect(calls[0].text).not.toMatch(/\bembedding\b/i);
  expect(calls[0].values).toEqual([
    ["wardrobe://wardrobe-upload-1"],
    "uploaded",
    "user@example.com",
    "uploaded",
  ]);
  expect(calls[1].text).not.toMatch(/\bembedding\b/i);
  expect(calls[1].values).toEqual([
    ["https://example.com/catalog-shirt"],
    "from_catalog",
    "user@example.com",
    "from_catalog",
  ]);
});

test("db integration lists wardrobe items by ids in caller order", async () => {
  const wardrobeRow: WardrobeRow = {
    id: "42",
    profileEmail: "user@example.com",
    productId: null,
    name: "Uploaded shirt",
    url: "wardrobe://42",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[wardrobeRow]]);
  setSqlClientOverride(sql);

  const empty = await listWardrobeItemsByIdsForEmail({
    email: "user@example.com",
    ids: [0, -1, Number.NaN],
  });
  const listed = await listWardrobeItemsByIdsForEmail({
    email: "user@example.com",
    ids: [42, 7, 42],
  });

  expect(empty).toEqual([]);
  expect(listed).toEqual([
    expect.objectContaining({
      id: "42",
      source: "uploaded",
    }),
  ]);
  expect(calls).toHaveLength(1);
  expect(calls[0].text).toMatch(/id = any/i);
  expect(calls[0].text).toMatch(/array_position/i);
  expect(calls[0].text).not.toMatch(/\bembedding\b/i);
  expect(calls[0].values).toEqual(["user@example.com", [42, 7], [42, 7]]);
});

test("db integration returns null when catalog wardrobe save finds no product", async () => {
  const { sql, calls } = createSqlMock([[]]);
  setSqlClientOverride(sql);

  const saved = await saveWardrobeItemFromCatalogByUrl({
    email: "user@example.com",
    url: "https://example.com/products/missing",
  });

  expect(saved).toBeNull();
  expect(calls).toHaveLength(1);
  expect(calls[0].text).toMatch(/insert into wardrobe/i);
  expect(calls[0].text).toMatch(/products\.embedding/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toEqual([
    "user@example.com",
    "https://example.com/products/missing",
  ]);
});

test("db integration saves uploaded wardrobe items", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: null,
    url: "wardrobe://wardrobe-upload-1",
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "uploaded",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([
    [{ id: "wardrobe-upload-1" }],
    [uploadedRow],
  ]);
  setSqlClientOverride(sql);

  const saved = await saveUploadedWardrobeItemsByEmail({
    email: "user@example.com",
    imageUrls: ["https://images.example.com/wardrobe/user/image.webp"],
  });

  expect(saved).toEqual([
    expect.objectContaining({
      id: "wardrobe-upload-1",
      url: "wardrobe://wardrobe-upload-1",
      imageUrl: "https://images.example.com/wardrobe/user/image.webp",
      rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
      source: "uploaded",
      processingStatus: "uploaded",
    }),
  ]);
  expect(calls[0].text).toMatch(/insert into wardrobe/i);
  expect(calls[0].text).toMatch(/jsonb_array_elements/i);
  expect(calls[0].values).toEqual([
    JSON.stringify([
      {
        imageUrl: "https://images.example.com/wardrobe/user/image.webp",
        ownedR2ImageKeys: [],
        rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
        url: null,
      },
    ]),
    "user@example.com",
  ]);
  expect(calls[1].text).toMatch(/update wardrobe/i);
  expect(calls[1].text).toMatch(/coalesce\(nullif\(trim\(wardrobe\.url\)/i);
  expect(calls[1].text).toMatch(/array_position/i);
  expect(calls[1].text).not.toMatch(/select\s+\*/i);
  expect(calls[1].text).not.toMatch(/\bembedding\b/i);
  expect(calls[1].values).toEqual([
    ["wardrobe-upload-1"],
    ["wardrobe-upload-1"],
  ]);
});

test("db integration saves uploaded wardrobe URL import items with product URLs", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-url-1",
    profileEmail: "user@example.com",
    productId: null,
    name: null,
    url: "https://shop.example.com/product",
    imageUrl: "https://cdn.example.com/product.jpg",
    source: "uploaded",
    rawImageUrl: "https://cdn.example.com/product.jpg",
    processingStatus: "uploaded",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([
    [{ id: "wardrobe-upload-url-1" }],
    [uploadedRow],
  ]);
  setSqlClientOverride(sql);

  const saved = await saveUploadedWardrobeItemsByEmail({
    email: "user@example.com",
    items: [
      {
        imageUrl: "https://cdn.example.com/product.jpg",
        ownedR2ImageKeys: [],
        rawImageUrl: "https://cdn.example.com/product.jpg",
        url: "https://shop.example.com/product",
      },
    ],
  });

  expect(saved).toEqual([
    expect.objectContaining({
      id: "wardrobe-upload-url-1",
      url: "https://shop.example.com/product",
      imageUrl: "https://cdn.example.com/product.jpg",
      rawImageUrl: "https://cdn.example.com/product.jpg",
      source: "uploaded",
    }),
  ]);
  expect(calls[0].values).toEqual([
    JSON.stringify([
      {
        imageUrl: "https://cdn.example.com/product.jpg",
        ownedR2ImageKeys: [],
        rawImageUrl: "https://cdn.example.com/product.jpg",
        url: "https://shop.example.com/product",
      },
    ]),
    "user@example.com",
  ]);
  expect(calls[1].text).toMatch(/coalesce\(nullif\(trim\(wardrobe\.url\)/i);
});

test("db integration ignores uploaded wardrobe items without http urls", async () => {
  const { sql, calls } = createSqlMock([]);
  setSqlClientOverride(sql);

  const saved = await saveUploadedWardrobeItemsByEmail({
    email: "user@example.com",
    imageUrls: ["", "ftp://images.example.com/item.webp", "   "],
  });

  expect(saved).toEqual([]);
  expect(calls).toHaveLength(0);
});

test("db integration skips uploaded wardrobe url update when insert returns no ids", async () => {
  const { sql, calls } = createSqlMock([[]]);
  setSqlClientOverride(sql);

  const saved = await saveUploadedWardrobeItemsByEmail({
    email: "user@example.com",
    imageUrls: ["https://images.example.com/wardrobe/user/image.webp"],
  });

  expect(saved).toEqual([]);
  expect(calls).toHaveLength(1);
  expect(calls[0].text).toMatch(/insert into wardrobe/i);
});

test("db integration deletes uploaded wardrobe items by id", async () => {
  const uploadedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Uploaded shirt",
    url: null,
    imageUrl: "https://images.example.com/wardrobe/user/image_clean.png",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[uploadedRow]]);
  setSqlClientOverride(sql);

  const deleted = await deleteUploadedWardrobeItemById({
    email: "user@example.com",
    id: " wardrobe-upload-1 ",
  });

  expect(deleted).toEqual(
    expect.objectContaining({
      id: "wardrobe-upload-1",
      imageUrl: "https://images.example.com/wardrobe/user/image_clean.png",
      rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
      source: "uploaded",
    }),
  );
  expect(calls[0].text).toMatch(/delete from wardrobe/i);
  expect(calls[0].text).toMatch(/source = 'uploaded'/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toEqual(["user@example.com", "wardrobe-upload-1"]);
});

test("db integration skips uploaded wardrobe delete for blank ids", async () => {
  const { sql, calls } = createSqlMock([]);
  setSqlClientOverride(sql);

  const deleted = await deleteUploadedWardrobeItemById({
    email: "user@example.com",
    id: "   ",
  });

  expect(deleted).toBeNull();
  expect(calls).toEqual([]);
});

test("db integration lists uploaded wardrobe R2 keys for account cleanup", async () => {
  const { sql, calls } = createSqlMock([
    [
      {
        ownedR2ImageKeys: [
          "wardrobe/542d240129883c01/item.webp",
          "wardrobe/542d240129883c01/item_clean.png",
          "wardrobe/other-profile/item.webp",
          "https://assets.example.com/wardrobe/542d240129883c01/item.webp",
        ],
      },
      {
        ownedR2ImageKeys: [
          "wardrobe/542d240129883c01/item_clean.png",
          "wardrobe/542d240129883c01/item_clean_320.webp",
        ],
      },
    ],
  ]);
  setSqlClientOverride(sql);

  const keys = await listUploadedWardrobeR2KeysByEmail({
    email: "person@example.com",
  });

  expect(keys).toEqual([
    "wardrobe/542d240129883c01/item.webp",
    "wardrobe/542d240129883c01/item_clean.png",
    "wardrobe/542d240129883c01/item_clean_320.webp",
  ]);
  expect(calls[0].text).toMatch(/select owned_r2_image_keys/i);
  expect(calls[0].values).toEqual(["person@example.com"]);
});

test("db integration updates uploaded wardrobe item metadata status", async () => {
  const updatedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Linen shirt",
    url: null,
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "metadata_processed",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[updatedRow]]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemMetadataById({
    email: "user@example.com",
    embedding: [0.1, 0.2],
    id: "wardrobe-upload-1",
    processingStatus: "metadata_processed",
    metadata: {
      name: "Linen shirt",
      description: null,
      brand: null,
      audience: "women",
      category: "top",
      season: ["summer"],
      formality_level: ["smart_casual"],
      style: [],
      occasions: [],
      color_base: ["white"],
      is_neutral: true,
      pattern: "solid",
      finish: null,
      composition: "linen",
      silhouette: null,
      fit: "regular",
      closure_type: ["button"],
    },
  });

  expect(saved).toEqual(
    expect.objectContaining({
      id: "wardrobe-upload-1",
      name: "Linen shirt",
      processingStatus: "metadata_processed",
    }),
  );
  expect(calls[0].text).toMatch(/update wardrobe/i);
  expect(calls[0].text).toMatch(/processing_status =/i);
  expect(calls[0].text).toMatch(/embedding =/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toEqual([
    "Linen shirt",
    null,
    null,
    "women",
    "top",
    ["summer"],
    ["smart_casual"],
    [],
    [],
    ["white"],
    true,
    "solid",
    null,
    "linen",
    null,
    "regular",
    ["button"],
    "[0.1,0.2]",
    null,
    [],
    [],
    "metadata_processed",
    "user@example.com",
    "wardrobe-upload-1",
  ]);
});

test("db integration marks uploaded wardrobe item metadata failed", async () => {
  const failedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: null,
    url: null,
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "failed",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[failedRow]]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemMetadataById({
    email: "user@example.com",
    id: " wardrobe-upload-1 ",
    processingStatus: "failed",
    metadata: null,
  });

  expect(saved).toEqual(
    expect.objectContaining({
      id: "wardrobe-upload-1",
      processingStatus: "failed",
    }),
  );
  expect(calls[0].text).toMatch(/update wardrobe/i);
  expect(calls[0].text).toMatch(/processing_status = 'failed'/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toEqual(["user@example.com", "wardrobe-upload-1"]);
});

test("db integration skips uploaded wardrobe metadata update for blank ids", async () => {
  const { sql, calls } = createSqlMock([]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemMetadataById({
    email: "user@example.com",
    id: "   ",
    processingStatus: "failed",
    metadata: null,
  });

  expect(saved).toBeNull();
  expect(calls).toEqual([]);
});

test("db integration updates uploaded wardrobe item details", async () => {
  const updatedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Updated shirt",
    url: null,
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "ready",
    isNeutral: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[updatedRow]]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemDetailsById({
    email: "user@example.com",
    embedding: [0.3, 0.4],
    id: " wardrobe-upload-1 ",
    details: {
      name: "Updated shirt",
      description: "Button-front shirt",
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: ["casual"],
      style: ["minimalistic"],
      occasions: ["office"],
      colorBase: ["red"],
      pattern: "solid",
      finish: null,
      composition: "linen, cotton",
      silhouette: null,
      fit: "regular",
      closureType: ["button"],
    },
    processingStatus: "ready",
  });

  expect(saved).toEqual(
    expect.objectContaining({
      id: "wardrobe-upload-1",
      name: "Updated shirt",
      processingStatus: "ready",
      isNeutral: false,
    }),
  );
  expect(calls[0].text).toMatch(/update wardrobe/i);
  expect(calls[0].text).toMatch(/source = 'uploaded'/i);
  expect(calls[0].text).toMatch(/embedding =/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toEqual([
    "Updated shirt",
    "Button-front shirt",
    null,
    "all",
    "top",
    ["summer"],
    ["casual"],
    ["minimalistic"],
    ["office"],
    ["red"],
    false,
    "solid",
    null,
    "linen, cotton",
    null,
    "regular",
    ["button"],
    "[0.3,0.4]",
    "ready",
    "user@example.com",
    "wardrobe-upload-1",
  ]);
});

test("db integration saves failed uploaded detail update with null embedding", async () => {
  const updatedRow: WardrobeRow = {
    id: "wardrobe-upload-1",
    profileEmail: "user@example.com",
    productId: null,
    name: "Updated shirt",
    url: null,
    imageUrl: "https://images.example.com/wardrobe/user/image.webp",
    source: "uploaded",
    rawImageUrl: "https://images.example.com/wardrobe/user/image.webp",
    processingStatus: "failed",
    isNeutral: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const { sql, calls } = createSqlMock([[updatedRow]]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemDetailsById({
    email: "user@example.com",
    embedding: null,
    id: " wardrobe-upload-1 ",
    details: {
      name: "Updated shirt",
      description: null,
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      colorBase: ["white"],
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: [],
    },
    processingStatus: "failed",
  });

  expect(saved).toEqual(
    expect.objectContaining({
      id: "wardrobe-upload-1",
      processingStatus: "failed",
      isNeutral: true,
    }),
  );
  expect(calls[0].text).toMatch(/embedding =/i);
  expectNoEmbeddingInReturning(calls[0]);
  expect(calls[0].values).toContain("failed");
  expect(calls[0].values).toContain(null);
});

test("db integration skips uploaded wardrobe detail update for blank ids", async () => {
  const { sql, calls } = createSqlMock([]);
  setSqlClientOverride(sql);

  const saved = await updateUploadedWardrobeItemDetailsById({
    email: "user@example.com",
    id: "   ",
    details: {
      name: "Updated shirt",
      description: null,
      brand: null,
      audience: "all",
      category: "top",
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      colorBase: [],
      pattern: null,
      finish: null,
      composition: null,
      silhouette: null,
      fit: null,
      closureType: [],
    },
  });

  expect(saved).toBeNull();
  expect(calls).toEqual([]);
});

test("db integration applies price range to product stats price buckets", async () => {
  const handlers = [
    [{ total: 1 }] satisfies CountRow[],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [{ bucket: 1, count: 1, rangeMin: 20, rangeMax: 80 }],
  ];
  const { sql, calls } = createSqlMock(handlers);
  setSqlClientOverride(sql);

  const stats = await searchProductStats({
    priceMin: 20,
    priceMax: 80,
  });

  const priceBucketQuery = calls.at(-1);
  expect(stats.total).toBe(1);
  expect(stats.priceBuckets.length).toBe(100);
  expect(stats.priceBuckets[0]).toEqual({
    key: "20:20.6",
    min: 20,
    max: 20.6,
    count: 1,
  });
  expect(stats.priceBuckets.at(-1)).toEqual({
    key: "79.4:80",
    min: 79.4,
    max: 80,
    count: 0,
  });
  expect(priceBucketQuery.text).toMatch(/with filtered as/i);
  expect(priceBucketQuery.text).toMatch(/price >=/i);
  expect(priceBucketQuery.text).toMatch(/price <=/i);
  expect(priceBucketQuery.values.includes(20)).toBe(true);
  expect(priceBucketQuery.values.includes(80)).toBe(true);
  expect(calls.length).toBe(14);
});

test("db integration shapes reduced profile persistence queries", async () => {
  const { sql, calls } = createSqlMock([
    [
      {
        email: "user@example.com",
        activeCapsuleId: null,
        locale: "en",
        fullname: null,
        theme: "system",
        llm: "openai:gpt-5.5",
        imageLlm: "openai:gpt-image-2",
      },
    ] satisfies ProfileRow[],
    [
      {
        email: "user@example.com",
        activeCapsuleId: null,
        locale: "ru",
        fullname: null,
        theme: "system",
        llm: "openai:gpt-5.5",
        imageLlm: "openai:gpt-image-2",
      },
    ] satisfies ProfileRow[],
    [
      {
        email: "user@example.com",
        activeCapsuleId: null,
        locale: "ru",
        fullname: "Ada Lovelace",
        theme: "dark",
        llm: "claude:claude-opus-4-7",
        imageLlm: "gemini:gemini-3-pro-image",
      },
    ] satisfies ProfileRow[],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [{ email: "user@example.com" }],
  ]);
  setSqlClientOverride(sql);

  await createProfileRecord({
    email: "user@example.com",
    locale: "en",
  });
  await updateProfileLocaleByEmail({ email: "user@example.com", locale: "ru" });
  await updateProfileByEmail({
    email: "user@example.com",
    locale: "ru",
    fullname: "Ada Lovelace",
    theme: "dark",
    llm: "claude:claude-opus-4-7",
    imageLlm: "gemini:gemini-3-pro-image",
  });
  const deleted = await deleteProfileByEmail("user@example.com");

  expect(deleted).toBe(true);

  expect(calls[0].text).toMatch(/insert into profiles/i);
  expect(calls[0].values).toEqual(["user@example.com", "en"]);
  expect(calls[1].text).toMatch(/update profiles\s+set[\s\S]*locale =/i);
  expect(calls[1].values).toEqual(["ru", "user@example.com"]);
  expect(calls[2].text).toMatch(/update profiles\s+set[\s\S]*fullname =/i);
  expect(calls[2].values).toEqual([
    "ru",
    "Ada Lovelace",
    "dark",
    "claude:claude-opus-4-7",
    "gemini:gemini-3-pro-image",
    "user@example.com",
  ]);
  expect(calls[3].text).toMatch(/delete from user_sessions/i);
  expect(calls[4].text).toMatch(/delete from login_codes/i);
  expect(calls[5].text).toMatch(/delete from mcp_oauth_refresh_tokens/i);
  expect(calls[6].text).toMatch(/delete from mcp_oauth_grants/i);
  expect(calls[7].text).toMatch(/delete from mcp_oauth_authorization_codes/i);
  expect(calls[7].text).toMatch(/consumed_at is null/i);
  expect(calls[8].text).toMatch(/delete from passkey_challenges/i);
  expect(calls[9].text).toMatch(/delete from capsules/i);
  expect(calls[10].text).toMatch(/delete from outfits/i);
  expect(calls[11].text).toMatch(/delete from shared_capsules/i);
  expect(calls[12].text).toMatch(/delete from personal_items_reports/i);
  expect(calls[13].text).toMatch(/delete from wardrobe/i);
  expect(calls[14].text).toMatch(/delete from user_liked_items/i);
  expect(calls[15].text).toMatch(/delete from search/i);
  expect(calls[16].text).toMatch(/delete from profile_passkeys/i);
  expect(calls[17].text).toMatch(/delete from profiles/i);
});

test("db integration checkDatabaseConnection selects current database metadata", async () => {
  const { sql, calls } = createSqlMock([
    [
      { database: "capsule", now: new Date("2026-03-29T12:00:00.000Z") },
    ] satisfies DatabaseConnectionRow[],
  ]);
  setSqlClientOverride(sql);

  const row = await checkDatabaseConnection();

  expect(row.database).toBe("capsule");
  expect(calls[0].text).toMatch(/current_database\(\) as database/i);
});
