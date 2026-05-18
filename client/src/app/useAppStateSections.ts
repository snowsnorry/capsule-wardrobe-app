import { useRef, useState } from "react";
import { initialStatus } from "./appConstants";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  CapsuleMeta,
  CapsuleSourceMode,
  CapsuleSidebarActions,
  OutfitSetSnapshot,
  SessionStep,
  StatusState,
  UserLike,
  WardrobeItem,
} from "./appTypes";

export function useSessionAppState() {
  const [step, setStep] = useState<SessionStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [user, setUser] = useState<UserLike | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileCreated, setProfileCreated] = useState(false);

  return {
    code,
    email,
    hasProfile,
    isCheckingSession,
    isSignOutConfirmOpen,
    profileCreated,
    sessionInitialized,
    setCode,
    setEmail,
    setHasProfile,
    setIsCheckingSession,
    setIsSignOutConfirmOpen,
    setProfileCreated,
    setSessionInitialized,
    setStatus,
    setStep,
    setUser,
    status,
    step,
    user,
  };
}

export function useProfileFilterAppState() {
  const [selectedFormalityLevel, setSelectedFormalityLevel] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string[]>([]);
  const [selectedAudience, setSelectedAudience] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState("solid");
  const [selectedSourceMode, setSelectedSourceMode] =
    useState<CapsuleSourceMode>("catalog_only");
  const [selectedText, setSelectedText] = useState("");
  const [selectedAnchorWardrobeItemIds, setSelectedAnchorWardrobeItemIds] =
    useState<string[]>([]);
  const [currentView, setCurrentView] = useState("main");
  const [settingsProfile, setSettingsProfile] = useState(() =>
    normalizeProfileSettings(),
  );

  return {
    currentView,
    selectedAudience,
    selectedColor,
    selectedFormalityLevel,
    selectedOccasions,
    selectedPattern,
    selectedSeason,
    selectedSourceMode,
    selectedStyle,
    selectedText,
    selectedAnchorWardrobeItemIds,
    setCurrentView,
    setSelectedAudience,
    setSelectedColor,
    setSelectedFormalityLevel,
    setSelectedOccasions,
    setSelectedPattern,
    setSelectedSeason,
    setSelectedSourceMode,
    setSelectedStyle,
    setSelectedText,
    setSelectedAnchorWardrobeItemIds,
    setSettingsProfile,
    settingsProfile,
  };
}

export function useCapsuleAppState() {
  const [profileItems, setProfileItems] = useState<WardrobeItem[] | null>(null);
  const [profileOutfitSets, setProfileOutfitSets] = useState<
    OutfitSetSnapshot[]
  >([]);
  const [activeCapsuleId, setActiveCapsuleId] = useState("");
  const [activeCapsuleMeta, setActiveCapsuleMeta] =
    useState<CapsuleMeta | null>(null);
  const [capsuleList, setCapsuleList] = useState<CapsuleMeta[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isContentOperationLoading, setIsContentOperationLoading] =
    useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] =
    useState(false);

  return {
    activeCapsuleId,
    activeCapsuleMeta,
    capsuleList,
    isContentOperationLoading,
    isDownloadingWardrobePdf,
    isLoadingItems,
    profileItems,
    profileOutfitSets,
    setActiveCapsuleId,
    setActiveCapsuleMeta,
    setCapsuleList,
    setIsContentOperationLoading,
    setIsDownloadingWardrobePdf,
    setIsLoadingItems,
    setProfileItems,
    setProfileOutfitSets,
  };
}

export function useWardrobeProgressAppState() {
  const [selectedRegenerationUrls, setSelectedRegenerationUrls] = useState<
    string[]
  >([]);
  const [partialRegenerationPendingUrls, setPartialRegenerationPendingUrls] =
    useState<string[]>([]);
  const [pendingImageSetIndexes, setPendingImageSetIndexes] = useState<
    number[]
  >([]);
  const [isPartialRegenerationLoading, setIsPartialRegenerationLoading] =
    useState(false);
  const [isWardrobePending, setIsWardrobePending] = useState(false);
  const [hasPendingAdditionalItems, setHasPendingAdditionalItems] =
    useState(false);

  return {
    hasPendingAdditionalItems,
    isPartialRegenerationLoading,
    isWardrobePending,
    partialRegenerationPendingUrls,
    pendingImageSetIndexes,
    selectedRegenerationUrls,
    setHasPendingAdditionalItems,
    setIsPartialRegenerationLoading,
    setIsWardrobePending,
    setPartialRegenerationPendingUrls,
    setPendingImageSetIndexes,
    setSelectedRegenerationUrls,
  };
}

export function useAppRefs() {
  const isMountedRef = useRef(true);
  const pendingRegenerationUrlsRef = useRef<string[]>([]);
  const regenerationBaseItemsRef = useRef<WardrobeItem[]>([]);
  const capsuleEventsAbortRef = useRef<AbortController | null>(null);
  const manualWardrobeRegenerationCapsuleIdRef = useRef("");
  const pendingNotificationKindRef = useRef("");
  const capsuleSidebarActionsRef = useRef<CapsuleSidebarActions | null>(null);

  return {
    capsuleEventsAbortRef,
    capsuleSidebarActionsRef,
    isMountedRef,
    manualWardrobeRegenerationCapsuleIdRef,
    pendingNotificationKindRef,
    pendingRegenerationUrlsRef,
    regenerationBaseItemsRef,
  };
}
