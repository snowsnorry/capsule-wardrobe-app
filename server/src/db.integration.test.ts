import test from "node:test";
import assert from "node:assert/strict";
import {
  setSqlClientOverride,
  checkDatabaseConnection,
  upsertLoginCode,
  getLoginCodeByEmail,
  verifyAndConsumeLoginCode,
  insertSession,
  getSessionById,
  deleteSessionById,
  pruneExpiredSessions,
  getSearchByEmail,
  upsertSearchByEmail,
  searchProducts,
  searchProductStats,
  createProfileRecord,
  updateProfileByEmail,
  updateProfileLocaleByEmail,
  deleteProfileByEmail
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
type SqlResultHandler = SqlResultValue | ((context: SqlCallContext) => SqlResultValue);

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
  async function sql<TRow = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<TRow[] | { count: number }> {
    const text = strings.join(" ");
    calls.push({ strings: [...strings], values, text });
    const handler = handlers.shift();
    if (!handler) {
      throw new Error(`Unexpected SQL call: ${text}`);
    }
    if (typeof handler === "function") {
      return handler({ strings: [...strings], values, text, calls }) as TRow[] | { count: number };
    }
    return handler as TRow[] | { count: number };
  }
  return { sql, calls };
}

test.afterEach(() => {
  setSqlClientOverride(null);
});

test("db integration shapes login code persistence and verification queries", async () => {
  const expiresAt = new Date("2026-03-29T10:15:00.000Z");
  const { sql, calls } = createSqlMock([
    [],
    [{
      email: "user@example.com",
      codeHash: "hash-1",
      nonce: "nonce-1",
      expiresAt,
      attempts: 0,
      consumedAt: null
    }] satisfies LoginCodeRow[],
    [],
    [{ attempts: 3 }],
    [{ consumedAt: null, expiresAt: new Date(Date.now() + 60_000), attempts: 3 }]
  ]);
  setSqlClientOverride(sql);

  await upsertLoginCode({
    email: "user@example.com",
    codeHash: "hash-1",
    nonce: "nonce-1",
    expiresAt
  });
  const stored = await getLoginCodeByEmail("user@example.com");
  const invalid = await verifyAndConsumeLoginCode({
    email: "user@example.com",
    codeHash: "wrong-hash",
    maxAttempts: 5
  });

  assert.equal(stored?.email, "user@example.com");
  assert.deepEqual(invalid, { ok: false, reason: "invalid" });

  assert.match(calls[0].text, /insert into login_codes/i);
  assert.deepEqual(calls[0].values, ["user@example.com", "hash-1", "nonce-1", expiresAt]);
  assert.match(calls[1].text, /select\s+email,\s+"codeHash"/i);
  assert.deepEqual(calls[1].values, ["user@example.com"]);
  assert.match(calls[2].text, /update login_codes\s+set "consumedAt" = now\(\)/i);
  assert.deepEqual(calls[2].values, ["user@example.com", 5, "wrong-hash"]);
  assert.match(calls[3].text, /set attempts = attempts \+ 1/i);
  assert.deepEqual(calls[3].values, ["user@example.com", 5, "wrong-hash"]);
  assert.equal(calls.length, 4);
});

test("db integration shapes session persistence queries", async () => {
  const createdAt = new Date("2026-03-29T10:00:00.000Z");
  const expiresAt = new Date("2026-04-05T10:00:00.000Z");
  const { sql, calls } = createSqlMock([
    [],
    [{
      sessionId: "sess-1",
      email: "user@example.com",
      csrfToken: "csrf-1",
      createdAt,
      expiresAt
    }] satisfies SessionRow[],
    [],
    []
  ]);
  setSqlClientOverride(sql);

  await insertSession({
    sessionId: "sess-1",
    email: "user@example.com",
    csrfToken: "csrf-1",
    createdAt,
    expiresAt
  });
  const session = await getSessionById("sess-1");
  await deleteSessionById("sess-1");
  await pruneExpiredSessions();

  assert.equal(session?.sessionId, "sess-1");
  assert.match(calls[0].text, /insert into user_sessions/i);
  assert.deepEqual(calls[0].values, ["sess-1", "user@example.com", "csrf-1", createdAt, expiresAt]);
  assert.match(calls[1].text, /from user_sessions/i);
  assert.deepEqual(calls[1].values, ["sess-1"]);
  assert.match(calls[2].text, /delete from user_sessions where "sessionId" =/i);
  assert.deepEqual(calls[2].values, ["sess-1"]);
  assert.match(calls[3].text, /delete from user_sessions where "expiresAt" <= now\(\)/i);
});

test("db integration shapes search persistence and searchProducts queries", async () => {
  const { sql, calls } = createSqlMock([
    [{
      email: "user@example.com",
      query: "linen shirt",
      embedding: [0.1, 0.2],
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
      page: 2
    }] satisfies SearchRow[],
    [{
      email: "user@example.com",
      query: "linen shirt",
      embedding: [0.1, 0.2],
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
      page: 2
    }] satisfies SearchRow[],
    [{ total: 1 }] satisfies CountRow[],
    [{
      id: "prod-1",
      name: "Linen Shirt",
      brand: "Uniqlo",
      distance: 0.12
    }] satisfies ProductSearchRow[]
  ]);
  setSqlClientOverride(sql);

  const saved = await getSearchByEmail("user@example.com");
  const upserted = await upsertSearchByEmail({
    email: "user@example.com",
    query: "linen shirt",
    embedding: [0.1, 0.2],
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
    page: 2
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
    page: 2
  });

  assert.equal(saved?.email, "user@example.com");
  assert.equal(upserted?.page, 2);
  assert.equal(results.total, 1);
  assert.equal(results.page, 2);
  assert.equal(results.pageSize, 50);
  assert.equal(results.items[0]?.id, "prod-1");

  assert.match(calls[0].text, /from search\s+where email =/i);
  assert.deepEqual(calls[0].values, ["user@example.com"]);
  assert.match(calls[1].text, /insert into search/i);
  assert.equal(calls[1].values[0], "user@example.com");
  assert.equal(calls[1].values[2], JSON.stringify([0.1, 0.2]));
  assert.match(calls[2].text, /select count\(\*\)::integer as total\s+from products/i);
  assert.equal(calls[2].values[0][0], "uniqlo");
  assert.equal(calls[2].values.some((value) => value === "[0.1,0.2]"), true);
  assert.equal(calls[2].values.some((value) => value === 0.35), true);
  assert.match(calls[3].text, /case[\s\S]*embedding <=>[\s\S]*as distance/i);
  assert.equal(calls[3].values.filter((value) => value === 50).length >= 2, true);
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
    [{ bucket: 1, count: 1, rangeMin: 20, rangeMax: 80 }]
  ];
  const { sql, calls } = createSqlMock(handlers);
  setSqlClientOverride(sql);

  const stats = await searchProductStats({
    priceMin: 20,
    priceMax: 80
  });

  const priceBucketQuery = calls.at(-1);
  assert.equal(stats.total, 1);
  assert.equal(stats.priceBuckets.length, 100);
  assert.deepEqual(stats.priceBuckets[0], { key: "20:20.6", min: 20, max: 20.6, count: 1 });
  assert.deepEqual(stats.priceBuckets.at(-1), { key: "79.4:80", min: 79.4, max: 80, count: 0 });
  assert.match(priceBucketQuery.text, /with filtered as/i);
  assert.match(priceBucketQuery.text, /price >=/i);
  assert.match(priceBucketQuery.text, /price <=/i);
  assert.equal(priceBucketQuery.values.includes(20), true);
  assert.equal(priceBucketQuery.values.includes(80), true);
  assert.equal(calls.length, 14);
});

test("db integration shapes reduced profile persistence queries", async () => {
  const { sql, calls } = createSqlMock([
    [{
      email: "user@example.com",
      activeCapsuleId: null,
      locale: "en",
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.4",
      imageLlm: "openai:gpt-image-2"
    }] satisfies ProfileRow[],
    [{
      email: "user@example.com",
      activeCapsuleId: null,
      locale: "ru",
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.4",
      imageLlm: "openai:gpt-image-2"
    }] satisfies ProfileRow[],
    [{
      email: "user@example.com",
      activeCapsuleId: null,
      locale: "ru",
      fullname: "Ada Lovelace",
      theme: "dark",
      llm: "claude:claude-opus-4-7",
      imageLlm: "gemini:gemini-3-pro-image-preview"
    }] satisfies ProfileRow[],
    [],
    [{ email: "user@example.com" }]
  ]);
  setSqlClientOverride(sql);

  await createProfileRecord({
    email: "user@example.com",
    locale: "en"
  });
  await updateProfileLocaleByEmail({ email: "user@example.com", locale: "ru" });
  await updateProfileByEmail({
    email: "user@example.com",
    locale: "ru",
    fullname: "Ada Lovelace",
    theme: "dark",
    llm: "claude:claude-opus-4-7",
    imageLlm: "gemini:gemini-3-pro-image-preview"
  });
  const deleted = await deleteProfileByEmail("user@example.com");

  assert.equal(deleted, true);

  assert.match(calls[0].text, /insert into profiles/i);
  assert.deepEqual(calls[0].values, ["user@example.com", "en"]);
  assert.match(calls[1].text, /update profiles\s+set[\s\S]*locale =/i);
  assert.deepEqual(calls[1].values, ["ru", "user@example.com"]);
  assert.match(calls[2].text, /update profiles\s+set[\s\S]*fullname =/i);
  assert.deepEqual(calls[2].values, [
    "ru",
    "Ada Lovelace",
    "dark",
    "claude:claude-opus-4-7",
    "gemini:gemini-3-pro-image-preview",
    "user@example.com"
  ]);
  assert.match(calls[3].text, /delete from capsules/i);
  assert.match(calls[4].text, /delete from profiles/i);
});

test("db integration checkDatabaseConnection selects current database metadata", async () => {
  const { sql, calls } = createSqlMock([
    [{ database: "capsule", now: new Date("2026-03-29T12:00:00.000Z") }] satisfies DatabaseConnectionRow[]
  ]);
  setSqlClientOverride(sql);

  const row = await checkDatabaseConnection();

  assert.equal(row.database, "capsule");
  assert.match(calls[0].text, /current_database\(\) as database/i);
});
