import { useRef, useState } from "react";
import { initialStatus } from "./appConstants";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  CapsuleMeta,
  AnchorItemRef,
  CapsulePagination,
  CapsuleSourceMode,
  CapsuleSidebarActions,
  OutfitMeta,
  OutfitSidebarActions,
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
  const [selectedAnchorItemRefs, setSelectedAnchorItemRefs] = useState<
    AnchorItemRef[]
  >([]);
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
    selectedAnchorItemRefs,
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
    setSelectedAnchorItemRefs,
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
  const [activeOutfitId, setActiveOutfitId] = useState("");
  const [activeOutfitMeta, setActiveOutfitMeta] = useState<OutfitMeta | null>(
    null,
  );
  const [outfitList, setOutfitList] = useState<OutfitMeta[]>([]);
  const [outfitPagination, setOutfitPagination] = useState<CapsulePagination>({
    limit: 10,
    offset: 0,
    total: 0,
    hasMore: false,
  });
  const [capsulePagination, setCapsulePagination] = useState<CapsulePagination>(
    {
      limit: 10,
      offset: 0,
      total: 0,
      hasMore: false,
    },
  );
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isContentOperationLoading, setIsContentOperationLoading] =
    useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] =
    useState(false);
  const [isOutfitImagePending, setIsOutfitImagePending] = useState(false);
  const [isOutfitReportPending, setIsOutfitReportPending] = useState(false);
  const [isCapsuleReportPending, setIsCapsuleReportPending] = useState(false);

  return {
    activeCapsuleId,
    activeCapsuleMeta,
    activeOutfitId,
    activeOutfitMeta,
    capsuleList,
    capsulePagination,
    isContentOperationLoading,
    isDownloadingWardrobePdf,
    isCapsuleReportPending,
    isOutfitImagePending,
    isOutfitReportPending,
    isLoadingItems,
    outfitList,
    outfitPagination,
    profileItems,
    profileOutfitSets,
    setActiveCapsuleId,
    setActiveCapsuleMeta,
    setActiveOutfitId,
    setActiveOutfitMeta,
    setCapsuleList,
    setCapsulePagination,
    setIsContentOperationLoading,
    setIsDownloadingWardrobePdf,
    setIsCapsuleReportPending,
    setIsOutfitImagePending,
    setIsOutfitReportPending,
    setIsLoadingItems,
    setOutfitList,
    setOutfitPagination,
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
  const activeCapsuleIdRef = useRef("");
  const activeOutfitIdRef = useRef("");
  const pendingRegenerationUrlsRef = useRef<string[]>([]);
  const regenerationBaseItemsRef = useRef<WardrobeItem[]>([]);
  const capsuleEventsAbortRef = useRef<AbortController | null>(null);
  const manualWardrobeRegenerationCapsuleIdRef = useRef("");
  const pendingNotificationKindRef = useRef("");
  const capsuleSidebarActionsRef = useRef<CapsuleSidebarActions | null>(null);
  const outfitSidebarActionsRef = useRef<OutfitSidebarActions | null>(null);

  return {
    activeCapsuleIdRef,
    activeOutfitIdRef,
    capsuleEventsAbortRef,
    capsuleSidebarActionsRef,
    outfitSidebarActionsRef,
    isMountedRef,
    manualWardrobeRegenerationCapsuleIdRef,
    pendingNotificationKindRef,
    pendingRegenerationUrlsRef,
    regenerationBaseItemsRef,
  };
}
