import { test, expect } from "vitest";
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
  expect(normalizeFormalityLevel(" smart_casual ")).toBe("smart_casual");
  expect(normalizeFormalityLevel("retro")).toBe(null);
});

test("normalizeStyle normalizes optional style values", () => {
  expect(normalizeStyle(" avant_garde ")).toBe("avant_garde");
  expect(normalizeStyle("")).toBe(null);
  expect(normalizeStyle(null)).toBe(null);
});

test("normalizeColor keeps only allowed accent colors", () => {
  expect(normalizeColor(" Red ")).toBe("red");
  expect(normalizeColor("ultraviolet")).toBe(null);
  expect(normalizeColor("")).toBe(null);
});

test("normalizeOccasion keeps only supported profile occasions", () => {
  expect(normalizeOccasion(" everyday_errands ")).toBe("everyday_errands");
  expect(normalizeOccasion("school_drop-off")).toBe(null);
  expect(normalizeOccasion("weekend_with_family")).toBe(null);
});

test("normalizeOccasionList keeps supported profile occasions in first-seen order", () => {
  expect(normalizeOccasionList(["office", "school_drop-off", "everyday_errands", "office", "weekend_with_family"])).toEqual(["office", "everyday_errands"]);
});

test("getAudienceOptions returns supported profile audiences", () => {
  expect(getAudienceOptions()).toEqual(["man", "woman", "any"]);
});

test("getFormalityLevels returns fixed schema-based values", async () => {
  expect(await getFormalityLevels("user@example.com")).toEqual(["casual", "smart_casual", "formal"]);
});

test("getStyles returns fixed schema-based values", async () => {
  expect(await getStyles("user@example.com")).toEqual([
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
  expect(await getOccasions("user@example.com")).toEqual(PROFILE_OCCASION_OPTIONS);
});

test("getSeasons returns fixed schema-based values in schema order", async () => {
  expect(await getSeasons("user@example.com")).toEqual(PROFILE_SEASON_OPTIONS);
});

test("buildPatternOptions keeps all product-backed values and forces solid first", () => {
  const options = buildPatternOptions(["paisley", "snake", "check", "unknown", "stripe", "logo"]);

  expect(options[0]).toBe("solid");
  expect(options.includes("argyle")).toBeTruthy();
  expect(options.includes("graphic")).toBeTruthy();
  expect(options.includes("unknown")).toBeTruthy();
});

test("buildPatternOptions keeps current valid profile pattern even if absent in products", () => {
  const options = buildPatternOptions(["stripe"], "lace");

  expect(options[0]).toBe("solid");
  expect(options.includes("lace")).toBeTruthy();
  expect(options.includes("stripe")).toBeTruthy();
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

  expect(normalizeProfileRecord(input)).toEqual(expected);
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

  expect(normalizeProfileRecord(input)).toEqual(input);
});

test("rejected ids are deduped and trimmed", () => {
  expect(normalizeRejected({ rejected: [" 123 ", "123", "", "456", " 456 "] })).toEqual(["123", "456"]);
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

  expect(shouldResetRejected(current, next)).toBe(false);
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

  expect(shouldResetRejected(current, next)).toBe(true);
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

  expect((await store.getProfile("person@example.com"))?.fullname).toBe("Ada");
  expect(await store.hasProfile("person@example.com")).toBe(true);
  expect((await store.createProfile("new@example.com", {}))?.locale).toBe("en");
  expect((await store.updateProfile("person@example.com", {
    locale: "ru",
    fullname: "  Ada Lovelace  ",
    theme: "dark",
    llm: "invalid",
    imageLlm: "invalid"
  }))?.llm).toBe("openai:gpt-5.5");
  expect((await store.updateProfileLocale("person@example.com", "ru"))?.locale).toBe("ru");
  expect(await store.deleteProfile("person@example.com")).toBe(true);
  expect((await store.updateProfileActiveCapsuleId("person@example.com", "capsule-2"))?.activeCapsuleId).toBe("capsule-2");
  expect(calls.length).toBe(7);
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

  expect((await store.getPatternOptions("person@example.com")).includes("houndstooth")).toBeTruthy();
  expect(await failingStore.getPatternOptions("person@example.com")).toEqual(buildPatternOptions([]));
  expect(errors.length).toBe(1);
});
