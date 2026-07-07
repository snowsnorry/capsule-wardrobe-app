import { E2eCapsuleMemory, normalizeCapsuleId } from "./capsuleState.js";
import { E2eGenerationMemory } from "./generationState.js";
import { E2eOutfitMemory } from "./outfitState.js";
import { E2eSearchDelayState } from "./searchState.js";
import { E2eSelectedRegenerationMemory } from "./selectedRegenerationState.js";
import { E2eShareMemory } from "./shareState.js";
import { E2eWardrobeMemory } from "./wardrobeState.js";
import {
  buildE2eEmptyWardrobeCapsule,
  buildE2eProfile,
  buildE2eSavedSearchPayload,
  buildE2eSearchPayload,
  e2eImageUrl,
  E2E_EMAIL,
} from "./fixtures.js";
import type {
  E2eJobControls,
  E2ePersonalItemsReportSnapshot,
  E2eScenario,
  E2eSession,
} from "./stateTypes.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildSession(sessionId: string, email: string): E2eSession {
  const createdAt = Date.now();
  return {
    email,
    csrfToken: `csrf-${sessionId}`,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  };
}

export class E2eState {
  scenario: E2eScenario = "with-profile";
  sessions = new Map<string, E2eSession>();
  profile: Record<string, unknown> | null = buildE2eProfile();
  capsuleMemory = new E2eCapsuleMemory();
  outfitMemory = new E2eOutfitMemory();
  shareMemory = new E2eShareMemory();
  savedSearch = buildE2eSearchPayload();
  loginCodes = new Map<string, string>();
  sessionCounter = 0;
  outfitImageCounter = 0;
  wardrobeMemory = new E2eWardrobeMemory();
  selectedRegenerationMemory = new E2eSelectedRegenerationMemory();
  searchDelay = new E2eSearchDelayState();
  generationMemory = new E2eGenerationMemory();
  personalItemsReport: E2ePersonalItemsReportSnapshot | null = null;
  personalItemsReportCounter = 0;
  capsuleReportCounter = 0;
  jobControls: E2eJobControls | null = null;

  get capsules() {
    return this.capsuleMemory.capsules;
  }

  reset(scenario: E2eScenario = "with-profile") {
    this.scenario = scenario;
    this.sessions.clear();
    this.loginCodes.clear();
    this.sessionCounter = 0;
    this.shareMemory.reset();
    this.outfitImageCounter = 0;
    this.wardrobeMemory.reset();
    this.selectedRegenerationMemory.reset();
    this.searchDelay.clear();
    this.generationMemory.reset();
    this.personalItemsReport = null;
    this.personalItemsReportCounter = 0;
    this.capsuleReportCounter = 0;
    this.jobControls?.clearAll();
    this.outfitMemory.reset();
    this.capsuleMemory.reset(
      scenario === "empty-wardrobe"
        ? buildE2eEmptyWardrobeCapsule()
        : undefined,
    );
    this.profile = scenario === "no-profile" ? null : buildE2eProfile();
    this.savedSearch =
      scenario === "with-saved-search"
        ? buildE2eSavedSearchPayload()
        : buildE2eSearchPayload();
  }

  createSession(email = E2E_EMAIL) {
    this.sessionCounter += 1;
    const sessionId = `e2e-session-${this.sessionCounter}`;
    const session = buildSession(sessionId, email);
    this.sessions.set(sessionId, session);
    return {
      sessionId,
      session: {
        email,
        csrfToken: session.csrfToken,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
    };
  }

  setActiveCapsuleId(activeCapsuleId: string | null): Record<string, unknown> {
    this.profile = {
      ...buildE2eProfile(),
      ...this.profile,
      activeCapsuleId,
    };
    return this.profile;
  }

  nextOutfitImageUrl(capsuleId: unknown, setIndex: number): string {
    this.outfitImageCounter += 1;
    return e2eImageUrl(
      `generated-outfit-set-${normalizeCapsuleId(capsuleId)}-${setIndex}-${this.outfitImageCounter}`,
    );
  }

  resetShares(): void {
    this.shareMemory.reset();
  }

  getShareOgMetadataById(id: unknown) {
    return this.shareMemory.getOgMetadataById(id);
  }
}

export const e2eState = new E2eState();
