import { useRef, useState } from "react";
import { initialStatus } from "./appConstants";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  CapsuleMeta,
  CapsuleSidebarActions,
  OutfitSetSnapshot,
  SessionStep,
  StatusState,
  UserLike,
  WardrobeItem,
} from "./appTypes";

export function useAppState() {
  const [step, setStep] = useState<SessionStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [user, setUser] = useState<UserLike | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [selectedFormalityLevel, setSelectedFormalityLevel] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string[]>([]);
  const [selectedAudience, setSelectedAudience] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState("solid");
  const [selectedText, setSelectedText] = useState("");
  const [profileCreated, setProfileCreated] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [profileItems, setProfileItems] = useState<WardrobeItem[] | null>(null);
  const [profileOutfitSets, setProfileOutfitSets] = useState<
    OutfitSetSnapshot[]
  >([]);
  const [settingsProfile, setSettingsProfile] = useState(() =>
    normalizeProfileSettings(),
  );
  const [activeCapsuleId, setActiveCapsuleId] = useState("");
  const [activeCapsuleMeta, setActiveCapsuleMeta] =
    useState<CapsuleMeta | null>(null);
  const [capsuleList, setCapsuleList] = useState<CapsuleMeta[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isContentOperationLoading, setIsContentOperationLoading] =
    useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] =
    useState(false);
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
  const isMountedRef = useRef(true);
  const pendingRegenerationUrlsRef = useRef<string[]>([]);
  const regenerationBaseItemsRef = useRef<WardrobeItem[]>([]);
  const capsuleEventsAbortRef = useRef<AbortController | null>(null);
  const manualWardrobeRegenerationCapsuleIdRef = useRef("");
  const pendingNotificationKindRef = useRef("");
  const capsuleSidebarActionsRef = useRef<CapsuleSidebarActions | null>(null);

  return {
    activeCapsuleId,
    activeCapsuleMeta,
    capsuleEventsAbortRef,
    capsuleList,
    capsuleSidebarActionsRef,
    code,
    currentView,
    email,
    hasPendingAdditionalItems,
    hasProfile,
    isCheckingSession,
    isContentOperationLoading,
    isDownloadingWardrobePdf,
    isLoadingItems,
    isMountedRef,
    isPartialRegenerationLoading,
    isSignOutConfirmOpen,
    isWardrobePending,
    manualWardrobeRegenerationCapsuleIdRef,
    onboardingStep,
    partialRegenerationPendingUrls,
    pendingImageSetIndexes,
    pendingNotificationKindRef,
    pendingRegenerationUrlsRef,
    profileCreated,
    profileItems,
    profileOutfitSets,
    regenerationBaseItemsRef,
    selectedAudience,
    selectedColor,
    selectedFormalityLevel,
    selectedOccasions,
    selectedPattern,
    selectedRegenerationUrls,
    selectedSeason,
    selectedStyle,
    selectedText,
    sessionInitialized,
    setActiveCapsuleId,
    setActiveCapsuleMeta,
    setCapsuleList,
    setCode,
    setCurrentView,
    setEmail,
    setHasPendingAdditionalItems,
    setHasProfile,
    setIsCheckingSession,
    setIsContentOperationLoading,
    setIsDownloadingWardrobePdf,
    setIsLoadingItems,
    setIsPartialRegenerationLoading,
    setIsSignOutConfirmOpen,
    setIsWardrobePending,
    setOnboardingStep,
    setPartialRegenerationPendingUrls,
    setPendingImageSetIndexes,
    setProfileCreated,
    setProfileItems,
    setProfileOutfitSets,
    setSelectedAudience,
    setSelectedColor,
    setSelectedFormalityLevel,
    setSelectedOccasions,
    setSelectedPattern,
    setSelectedRegenerationUrls,
    setSelectedSeason,
    setSelectedStyle,
    setSelectedText,
    setSessionInitialized,
    setSettingsProfile,
    setStatus,
    setStep,
    setUser,
    settingsProfile,
    status,
    step,
    user,
  };
}
