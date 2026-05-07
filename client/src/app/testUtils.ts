import { vi } from "vitest";
import type {
  CapsuleDraft,
  CapsuleMeta,
  ProfileSettings,
  StatusState,
  WardrobeItem,
} from "./appTypes";
import type { AppActionContext } from "./actionContext";

export const testStatus: StatusState = {
  loading: false,
  error: "",
  infoKey: "",
  infoParams: null,
};

export function createTestDraft({
  items = [],
  pattern = "solid",
  text = "",
}: {
  items?: WardrobeItem[];
  pattern?: string | null;
  text?: string;
} = {}): CapsuleDraft {
  return {
    filters: {
      formalityLevel: "casual",
      style: "minimalistic",
      occasions: ["office"],
      season: ["summer"],
      audience: "woman",
      color: null,
      pattern: pattern as string,
      text,
    },
    data: {
      wardrobe: { items, outfitSets: [] },
      rejectedUrls: [],
    },
  };
}

export function createTestCapsule(
  overrides: Partial<CapsuleMeta> = {},
): CapsuleMeta {
  const draft = createTestDraft();
  return {
    id: "capsule-1",
    name: "Spring edit",
    draft,
    saved: null,
    effective: draft,
    status: "new",
    ...overrides,
  };
}

export function createTestProfile(
  overrides: Partial<ProfileSettings> = {},
): ProfileSettings {
  return {
    email: "person@example.com",
    locale: "en",
    fullname: "",
    theme: "system",
    llm: "none",
    imageLlm: "openai:gpt-image-2",
    ...overrides,
  };
}

export function createActionContext(
  overrides: AppActionContext = {},
): AppActionContext {
  return {
    activeCapsuleId: "capsule-1",
    applyCapsuleState: vi.fn(),
    applyWardrobeSnapshot: vi.fn(),
    bootstrapCapsules: vi.fn(async () => createTestProfile()),
    buildCurrentDraftSnapshot: vi.fn(() => createTestDraft()),
    capsuleEventsAbortRef: { current: null },
    clearShareRoute: vi.fn(),
    closeNotificationPrompt: vi.fn(),
    handleLogout: vi.fn(),
    isMountedRef: { current: true },
    isPartialRegenerationLoading: false,
    locale: "en",
    manualWardrobeRegenerationCapsuleIdRef: { current: "" },
    onboardingStep: 0,
    pendingNotificationKindRef: { current: "" },
    pendingRegenerationUrlsRef: { current: [] },
    profileItems: [],
    regenerationBaseItemsRef: { current: [] },
    resolveErrorMessage: vi.fn(
      (error: { message?: string } | null | undefined) =>
        error?.message || "resolved error",
    ),
    selectedAudience: "woman",
    selectedFormalityLevel: "casual",
    selectedOccasions: ["office"],
    selectedRegenerationUrls: [],
    selectedSeason: ["summer"],
    setActiveCapsuleMeta: vi.fn(),
    setCapsuleList: vi.fn(),
    setCurrentView: vi.fn(),
    setHasPendingAdditionalItems: vi.fn(),
    setHasProfile: vi.fn(),
    setIsContentOperationLoading: vi.fn(),
    setIsDownloadingWardrobePdf: vi.fn(),
    setIsLoadingItems: vi.fn(),
    setIsPartialRegenerationLoading: vi.fn(),
    setIsShareLoading: vi.fn(),
    setIsWardrobePending: vi.fn(),
    setLocale: vi.fn(),
    setOnboardingStep: vi.fn(),
    setPartialRegenerationPendingUrls: vi.fn(),
    setPendingImageSetIndexes: vi.fn(),
    setProfileCreated: vi.fn(),
    setProfileItems: vi.fn(),
    setProfileOutfitSets: vi.fn(),
    setSelectedRegenerationUrls: vi.fn(),
    setSettingsProfile: vi.fn(),
    setStatus: vi.fn(),
    settingsProfile: createTestProfile(),
    shareMetadata: { id: "share-1", name: "Shared edit" },
    startCapsuleEventStream: vi.fn(),
    startPendingNotificationFlow: vi.fn(),
    t: vi.fn(
      (key: string) =>
        ({
          "errors.downloadFailed": "Download failed",
          "errors.regenerateAllFailed":
            "Failed to regenerate the capsule. Your previous capsule was restored.",
          "errors.regenerateSelectedFailed":
            "Failed to regenerate selected items",
        })[key] || key,
    ),
    user: { email: "person@example.com" },
    ...overrides,
  };
}
