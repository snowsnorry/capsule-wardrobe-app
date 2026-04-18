import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeColor,
  normalizeFormalityLevel,
  normalizeStyle
} from "./profileStore.js";

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
