import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPatternOptions,
  createProfileStore,
  getFormalityLevels,
  getStyles,
  PROFILE_OCCASION_OPTIONS,
  PROFILE_SEASON_OPTIONS,
  normalizeProfileRecord,
  normalizeFormalityLevel,
  normalizeStyle,
  normalizeOccasion,
  normalizeOccasionList,
  normalizeColor,
  getAudienceOptions,
  getOccasions,
  getSeasons
} from "./profileStore.js";

type ProfileRecordFixture = {
  email: string;
  activeCapsuleId: string | null;
  locale: string;
  fullname: string | null;
  theme: string;
  llm: string;
  imageLlm?: string;
};

type RejectedProfile = {
  rejected?: unknown;
};

type RejectedResetProfile = {
  formalityLevel: string | null;
  style: string | null;
  occasions?: string[];
  season?: string[];
  audience: string;
  color: string | null;
  pattern: string | null;
  locale?: string;
};

function normalizeRejected(profile: RejectedProfile): string[] {
  return [...new Set(
    (Array.isArray(profile?.rejected) ? profile.rejected : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

function shouldResetRejected(current: RejectedResetProfile, next: RejectedResetProfile): boolean {
  return (
    current.formalityLevel !== normalizeFormalityLevel(next.formalityLevel)
    || current.style !== normalizeStyle(next.style)
    || JSON.stringify(current.occasions || []) !== JSON.stringify(next.occasions || [])
    || JSON.stringify(current.season || []) !== JSON.stringify(next.season || [])
    || current.audience !== next.audience
    || current.color !== normalizeColor(next.color)
    || current.pattern !== (typeof next.pattern === "string" && next.pattern.trim() ? next.pattern.trim().toLowerCase() : null)
  );
}

test("normalizeFormalityLevel keeps only known core styles", () => {
  assert.equal(normalizeFormalityLevel(" smart_casual "), "smart_casual");
  assert.equal(normalizeFormalityLevel("retro"), null);
});

test("normalizeStyle normalizes optional style values", () => {
  assert.equal(normalizeStyle(" avant_garde "), "avant_garde");
  assert.equal(normalizeStyle(""), null);
  assert.equal(normalizeStyle(null), null);
});

test("normalizeColor keeps only allowed accent colors", () => {
  assert.equal(normalizeColor(" Red "), "red");
  assert.equal(normalizeColor("ultraviolet"), null);
  assert.equal(normalizeColor(""), null);
});

test("normalizeOccasion keeps only supported profile occasions", () => {
  assert.equal(normalizeOccasion(" everyday_errands "), "everyday_errands");
  assert.equal(normalizeOccasion("school_drop-off"), null);
  assert.equal(normalizeOccasion("weekend_with_family"), null);
});

test("normalizeOccasionList keeps supported profile occasions in first-seen order", () => {
  assert.deepEqual(
    normalizeOccasionList(["office", "school_drop-off", "everyday_errands", "office", "weekend_with_family"]),
    ["office", "everyday_errands"]
  );
});

test("getAudienceOptions returns supported profile audiences", () => {
  assert.deepEqual(getAudienceOptions(), ["man", "woman", "any"]);
});

test("getFormalityLevels returns fixed schema-based values", async () => {
  assert.deepEqual(await getFormalityLevels("user@example.com"), ["casual", "smart_casual", "formal"]);
});

test("getStyles returns fixed schema-based values", async () => {
  assert.deepEqual(await getStyles("user@example.com"), [
    "minimalistic",
    "street_style",
    "romantic",
    "preppy",
    "retro",
    "boho",
    "nautical",
    "safari",
    "equestrian",
    "military",
    "grunge",
    "sporty"
  ]);
});

test("getOccasions returns fixed schema-based values in schema order", async () => {
  assert.deepEqual(await getOccasions("user@example.com"), PROFILE_OCCASION_OPTIONS);
});

test("getSeasons returns fixed schema-based values in schema order", async () => {
  assert.deepEqual(await getSeasons("user@example.com"), PROFILE_SEASON_OPTIONS);
});

test("buildPatternOptions keeps all product-backed values and forces solid first", () => {
  const options = buildPatternOptions(["paisley", "snake", "check", "unknown", "stripe", "logo"]);

  assert.equal(options[0], "solid");
  assert.ok(options.includes("argyle"));
  assert.ok(options.includes("graphic"));
  assert.ok(options.includes("unknown"));
});

test("buildPatternOptions keeps current valid profile pattern even if absent in products", () => {
  const options = buildPatternOptions(["stripe"], "lace");

  assert.equal(options[0], "solid");
  assert.ok(options.includes("lace"));
  assert.ok(options.includes("stripe"));
});

test("normalizeProfileRecord applies defaults for new profile fields", () => {
  const input: ProfileRecordFixture = {
    email: "user@example.com",
    activeCapsuleId: " capsule-1 ",
    locale: "en",
    fullname: "  ",
    theme: "invalid",
    llm: "",
    imageLlm: ""
  };

  const expected: ProfileRecordFixture = {
    email: "user@example.com",
    activeCapsuleId: "capsule-1",
    locale: "en",
    fullname: null,
    theme: "system",
    llm: "openai:gpt-5.5",
    imageLlm: "openai:gpt-image-2"
  };

  assert.deepEqual(
    normalizeProfileRecord(input),
    expected
  );
});

test("normalizeProfileRecord keeps a supported claude llm selection", () => {
  const input: ProfileRecordFixture = {
    email: "user@example.com",
    activeCapsuleId: null,
    locale: "en",
    fullname: "Ada",
    theme: "dark",
    llm: "claude:claude-opus-4-7",
    imageLlm: "gemini:gemini-3-pro-image-preview"
  };

  assert.deepEqual(
    normalizeProfileRecord(input),
    input
  );
});

test("rejected ids are deduped and trimmed", () => {
  assert.deepEqual(
    normalizeRejected({ rejected: [" 123 ", "123", "", "456", " 456 "] }),
    ["123", "456"]
  );
});

test("changing locale alone does not require rejected reset", () => {
  const current = {
    formalityLevel: "casual",
    style: "minimalistic",
    occasions: ["office"],
    season: ["spring"],
    audience: "woman",
    color: "red",
    pattern: "solid",
    locale: "en"
  };
  const next = {
    ...current,
    locale: "ru"
  };

  assert.equal(shouldResetRejected(current, next), false);
});

test("changing capsule-defining filters requires rejected reset", () => {
  const current = {
    formalityLevel: "casual",
    style: "minimalistic",
    occasions: ["office"],
    season: ["spring"],
    audience: "woman",
    color: "red",
    pattern: "solid"
  };
  const next = {
    ...current,
    color: "blue"
  };

  assert.equal(shouldResetRejected(current, next), true);
});

test("createProfileStore delegates profile persistence and normalizes returned records", async () => {
  const calls: unknown[] = [];
  const store = createProfileStore({
    getProfileByEmailImpl: async (email) => {
      calls.push({ type: "get", email });
      return {
        email,
        fullname: " Ada ",
        activeCapsuleId: " capsule-1 ",
        theme: "dark",
        llm: "openai:gpt-5.5",
        imageLlm: "openai:gpt-image-2"
      };
    },
    hasProfileByEmailImpl: async (email) => {
      calls.push({ type: "has", email });
      return true;
    },
    createProfileRecordImpl: async (payload) => {
      calls.push({ type: "create", payload });
      return { email: payload.email, locale: payload.locale };
    },
    updateProfileByEmailImpl: async (payload) => {
      calls.push({ type: "update", payload });
      return payload;
    },
    updateProfileLocaleByEmailImpl: async (payload) => {
      calls.push({ type: "locale", payload });
      return payload;
    },
    deleteProfileByEmailImpl: async (email) => {
      calls.push({ type: "delete", email });
      return true;
    },
    updateProfileActiveCapsuleIdByEmailImpl: async (payload) => {
      calls.push({ type: "active", payload });
      return payload;
    }
  });

  assert.equal((await store.getProfile("person@example.com"))?.fullname, "Ada");
  assert.equal(await store.hasProfile("person@example.com"), true);
  assert.equal((await store.createProfile("new@example.com", {}))?.locale, "en");
  assert.equal((await store.updateProfile("person@example.com", {
    locale: "ru",
    fullname: "  Ada Lovelace  ",
    theme: "dark",
    llm: "invalid",
    imageLlm: "invalid"
  }))?.llm, "openai:gpt-5.5");
  assert.equal((await store.updateProfileLocale("person@example.com", "ru"))?.locale, "ru");
  assert.equal(await store.deleteProfile("person@example.com"), true);
  assert.equal((await store.updateProfileActiveCapsuleId("person@example.com", "capsule-2"))?.activeCapsuleId, "capsule-2");
  assert.equal(calls.length, 7);
});

test("createProfileStore builds pattern options and falls back when product lookup fails", async () => {
  const errors = [];
  const store = createProfileStore({
    getDistinctProductPatternsImpl: async () => ["stripe", "houndstooth"]
  });
  const failingStore = createProfileStore({
    getDistinctProductPatternsImpl: async () => {
      throw new Error("db failed");
    },
    logErrorImpl: (...args) => {
      errors.push(args);
    }
  });

  assert.ok((await store.getPatternOptions("person@example.com")).includes("houndstooth"));
  assert.deepEqual(await failingStore.getPatternOptions("person@example.com"), buildPatternOptions([]));
  assert.equal(errors.length, 1);
});
