import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  ThemeProvider,
  Typography,
  useMediaQuery
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import {
  fetchCurrentUser,
  fetchProfileStatus,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  initializeProfile,
  logout,
  requestLoginCode,
  verifyLoginCode,
  signInWithGoogle
} from "./api/auth";
import { listPasskeys } from "./api/passkeys";
import { authenticateWithPasskey, isPasskeySupported, registerPasskey } from "./auth/passkeys";
import {
  createCapsule,
  deleteCapsule,
  downloadCapsulePdf,
  duplicateCapsule,
  fetchCapsule,
  fetchCapsuleBootstrap,
  fetchRecentCapsules,
  fetchSharedCapsule,
  importSharedCapsule,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  shareCapsule,
  updateCapsuleFilters
} from "./api/capsules";
import { clearProfileOptionsCache, loadProfileOptions } from "./api/profileOptionsCache";
import { clearRequestCache } from "./api/auth";
import {
  deleteOutfitSetImage as requestOutfitSetImageDeletion,
  generateOutfitSetImage as requestOutfitSetImageGeneration,
  regenerateCapsuleWardrobe as requestWardrobeRegeneration,
  regenerateSelectedWardrobeItems as requestSelectedWardrobeRegeneration,
  subscribeCapsuleEvents
} from "./api/wardrobe";
import SignInScreen from "./screens/SignInScreen";
import { useI18n } from "./i18n/useI18n";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";
import { createAppTheme } from "./theme";
import { DEFAULT_PROFILE_IMAGE_LLM, DEFAULT_PROFILE_LLM, DEFAULT_PROFILE_THEME } from "../../shared/profileSettings.js";
import {
  buildDisplayWardrobeItems,
  mergeWardrobeItemsIntoExistingOrder
} from "../../shared/wardrobeMerge.js";
import type { SettingsSavePayload } from "./components/SettingsDialog";
import AppSidebarNavigation from "./components/AppSidebarNavigation";
import AppSidebarShell from "./components/AppSidebarShell";
import LocaleSwitcher from "./components/LocaleSwitcher";

type StatusState = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type NotificationPromptState = {
  open: boolean;
};

type PasskeyPromptState = {
  open: boolean;
  loading: boolean;
};

type UserLike = {
  email?: string;
};

type SessionStep = "email" | "code";

type ProfileSettings = {
  email: string;
  locale: string;
  fullname: string;
  theme: string;
  llm: string;
  imageLlm: string;
  image_llm?: string;
};

type CapsuleFilters = {
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
};

type OutfitSetSnapshot = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

type WardrobeItem = {
  id?: string | number;
  url?: string;
  [key: string]: unknown;
};

type CapsuleWardrobeData = {
  items: WardrobeItem[];
  outfitSets?: OutfitSetSnapshot[];
  rawSelectionText?: string | null;
  swimwearReasoning?: string | null;
  swimwearRawSelectionText?: string | null;
};

type CapsuleDraft = {
  filters: CapsuleFilters;
  data: {
    wardrobe: CapsuleWardrobeData | null;
    rejectedUrls: string[];
  };
};

type CapsuleMeta = {
  id?: string;
  name?: string;
  draft?: CapsuleDraft | null;
  saved?: CapsuleDraft | null;
  effective?: CapsuleDraft | null;
  status?: string;
  updatedAt?: string;
};

type CapsuleSidebarActions = {
  openSearchDialog: () => void;
  openCapsuleActions: (event: MouseEvent<HTMLElement>, capsule: CapsuleMeta) => void;
};

type WardrobeSnapshot = {
  status?: string;
  items?: WardrobeItem[];
  outfitSets?: OutfitSetSnapshot[];
  pendingRegenerationUrls?: string[];
  pendingImageSetIndexes?: number[];
  hasPendingAdditionalItems?: boolean;
  rawSelectionText?: string | null;
  error?: string | null;
};

type ProfileOptionsResult = {
  styles: {
    core: string[];
    aesthetics: string[];
  };
  occasions: string[];
  seasons: string[];
  audience: string[];
  patterns: string[];
};

type CurrentUserResponse = {
  user?: UserLike | null;
};

type ProfileStatusResponse = {
  hasProfile?: boolean;
};

type AuthResultResponse = {
  user?: UserLike | null;
  expiresInMs?: number;
};

type CapsuleBootstrapResponse = {
  profile?: Partial<ProfileSettings>;
  activeCapsule?: CapsuleMeta | null;
  capsules?: CapsuleMeta[];
  activeSnapshot?: WardrobeSnapshot;
};

type CapsuleListResponse = {
  capsules?: CapsuleMeta[];
};

type CapsuleMutationResponse = {
  capsule?: CapsuleMeta | null;
  activeCapsule?: CapsuleMeta | null;
  status?: string;
};

type ShareMetadata = {
  id?: string;
  name?: string;
  expiresAt?: string | Date;
};

type WardrobeMutationResponse = {
  status?: string;
};

type AppRoute = "capsule" | "explore" | "statistics" | "share";

type AppNavigationOptions = {
  query?: string;
};

const MainScreen = lazy(() => import("./screens/MainScreen"));
const OnboardingScreen = lazy(() => import("./screens/OnboardingScreen"));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen"));
const SearchScreen = lazy(() => import("./screens/SearchScreen"));
const StatisticsScreen = lazy(() => import("./screens/StatisticsScreen"));

const initialStatus: StatusState = {
  loading: false,
  error: "",
  infoKey: "",
  infoParams: null
};

const initialNotificationPrompt: NotificationPromptState = {
  open: false
};

const initialPasskeyPrompt: PasskeyPromptState = {
  open: false,
  loading: false
};
const PASSKEY_PROMPT_DISMISSED_STORAGE_KEY = "capsule.passkeyPromptDismissed";

function RoutePanelFallback() {
  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        px: { xs: 3, md: 4 }
      }}
    >
      <LinearProgress aria-label="Loading section" sx={{ width: "100%" }} />
    </Box>
  );
}

const FALLBACK_STYLE_OPTIONS = {
  core: ["casual", "smart_casual", "formal"],
  aesthetics: ["minimalistic", "street_style", "romantic", "preppy", "retro", "boho", "nautical", "safari", "equestrian", "military", "grunge", "sporty"]
};

const FALLBACK_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "everyday_errands"
];

const FALLBACK_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

const FALLBACK_AUDIENCE_OPTIONS = ["man", "woman", "any"];
const FALLBACK_ACCENT_COLOR_OPTIONS = ACCENT_COLOR_OPTIONS;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];

function normalizeProfileSettings(profile: Partial<ProfileSettings> = {}, email = ""): ProfileSettings {
  return {
    email: String(profile?.email || email || "").trim(),
    locale: typeof profile?.locale === "string" && profile.locale.trim() ? profile.locale.trim() : "en",
    fullname: typeof profile?.fullname === "string" ? profile.fullname.trim() : "",
    theme: typeof profile?.theme === "string" && profile.theme.trim() ? profile.theme.trim() : DEFAULT_PROFILE_THEME,
    llm: typeof profile?.llm === "string" && profile.llm.trim() ? profile.llm.trim() : DEFAULT_PROFILE_LLM,
    imageLlm: typeof profile?.imageLlm === "string" && profile.imageLlm.trim()
      ? profile.imageLlm.trim()
      : (typeof profile?.image_llm === "string" && profile.image_llm.trim() ? profile.image_llm.trim() : DEFAULT_PROFILE_IMAGE_LLM)
  };
}

function getWardrobeMetadata(wardrobe: CapsuleWardrobeData | null | undefined) {
  return {
    rawSelectionText: wardrobe?.rawSelectionText || null,
    swimwearReasoning: wardrobe?.swimwearReasoning || null,
    swimwearRawSelectionText: wardrobe?.swimwearRawSelectionText || null
  };
}

function getAppRoute(pathname = "/"): AppRoute {
  if (pathname.startsWith("/share/")) {
    return "share";
  }
  if (pathname === "/explore" || pathname === "/explore/") {
    return "explore";
  }
  if (pathname === "/statistics" || pathname === "/statistics/") {
    return "statistics";
  }
  return "capsule";
}

function getShareIdFromPath(pathname = "") {
  const match = pathname.match(/^\/share\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function sortSeasonOptions(items) {
  return [...items].sort((left, right) => {
    const leftIndex = SEASON_DISPLAY_ORDER.indexOf(left);
    const rightIndex = SEASON_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? SEASON_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? SEASON_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function normalizeOutfitSets(outfitSets: unknown): OutfitSetSnapshot[] {
  return Array.isArray(outfitSets)
    ? outfitSets
      .map((set) => ({
        itemIds: Array.isArray(set?.itemIds)
          ? set.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
          : [],
        image: typeof set?.image === "string" && set.image.trim().length > 0
          ? set.image.trim()
          : null,
        imageObsolete: Boolean(set?.imageObsolete)
      }))
      .filter((set) => set.itemIds.length > 0)
    : [];
}

function buildCapsuleStatus(capsule: CapsuleMeta | null | undefined) {
  if (!capsule) {
    return "new";
  }
  if (capsule.saved && !capsule.draft) {
    return "saved";
  }
  if (capsule.saved && capsule.draft) {
    return JSON.stringify(capsule.saved) === JSON.stringify(capsule.draft) ? "saved" : "modified";
  }
  return "new";
}

function buildEmptyCapsuleDraft(): CapsuleDraft {
  return {
    filters: {
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: "solid",
      text: ""
    },
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  };
}

function getEffectiveCapsule(capsule: CapsuleMeta | null | undefined): CapsuleDraft | null {
  return capsule?.draft || capsule?.saved || null;
}

function normalizeComparableFilters(filters: Partial<CapsuleFilters> = {}) {
  return {
    formalityLevel: typeof filters.formalityLevel === "string" ? filters.formalityLevel : "",
    style: filters.style ?? null,
    occasions: Array.isArray(filters.occasions) ? [...filters.occasions].sort() : [],
    season: Array.isArray(filters.season) ? [...filters.season].sort() : [],
    audience: typeof filters.audience === "string" ? filters.audience : "",
    color: filters.color ?? null,
    pattern: typeof filters.pattern === "string" && filters.pattern.trim().length > 0 ? filters.pattern : "solid",
    text: typeof filters.text === "string" ? filters.text.trim() : ""
  };
}

function areFiltersEqual(left: Partial<CapsuleFilters>, right: Partial<CapsuleFilters>) {
  return JSON.stringify(normalizeComparableFilters(left)) === JSON.stringify(normalizeComparableFilters(right));
}

function hasStoredWardrobeItems(capsule: CapsuleMeta | null | undefined) {
  const items = getEffectiveCapsule(capsule)?.data?.wardrobe?.items;
  return Array.isArray(items) && items.length > 0;
}

async function retry(fn, attempts = 3, delayMs = 120) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function App() {
  const isLarge = useMediaQuery("(min-width:900px)");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, locale, setLocale } = useI18n();
  const [step, setStep] = useState<SessionStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [notificationPrompt, setNotificationPrompt] = useState(initialNotificationPrompt);
  const [passkeyPrompt, setPasskeyPrompt] = useState(initialPasskeyPrompt);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [user, setUser] = useState<UserLike | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [styleOptions, setStyleOptions] = useState(FALLBACK_STYLE_OPTIONS);
  const [occasionOptions, setOccasionOptions] = useState<string[]>([]);
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  const [audienceOptions, setAudienceOptions] = useState<string[]>([]);
  const [patternOptions, setPatternOptions] = useState<string[]>([]);
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
  const [profileOutfitSets, setProfileOutfitSets] = useState<OutfitSetSnapshot[]>([]);
  const [settingsProfile, setSettingsProfile] = useState(() => normalizeProfileSettings());
  const [activeCapsuleId, setActiveCapsuleId] = useState("");
  const [activeCapsuleMeta, setActiveCapsuleMeta] = useState<CapsuleMeta | null>(null);
  const [capsuleList, setCapsuleList] = useState<CapsuleMeta[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isContentOperationLoading, setIsContentOperationLoading] = useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] = useState(false);
  const [selectedRegenerationUrls, setSelectedRegenerationUrls] = useState<string[]>([]);
  const [partialRegenerationPendingUrls, setPartialRegenerationPendingUrls] = useState<string[]>([]);
  const [pendingImageSetIndexes, setPendingImageSetIndexes] = useState<number[]>([]);
  const [isPartialRegenerationLoading, setIsPartialRegenerationLoading] = useState(false);
  const [isWardrobePending, setIsWardrobePending] = useState(false);
  const [hasPendingAdditionalItems, setHasPendingAdditionalItems] = useState(false);
  const [wardrobeLoadedCapsuleId, setWardrobeLoadedCapsuleId] = useState("");
  const [appRoute, setAppRoute] = useState(() => (
    typeof window === "undefined" ? "capsule" : getAppRoute(window.location.pathname)
  ));
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [pendingShareId, setPendingShareId] = useState(() => (
    typeof window === "undefined" ? "" : getShareIdFromPath(window.location.pathname)
  ));
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const isMountedRef = useRef(true);
  const pendingRegenerationUrlsRef = useRef<string[]>([]);
  const regenerationBaseItemsRef = useRef<WardrobeItem[]>([]);
  const capsuleEventsAbortRef = useRef<AbortController | null>(null);
  const manualWardrobeRegenerationCapsuleIdRef = useRef("");
  const pendingNotificationKindRef = useRef("");
  const capsuleSidebarActionsRef = useRef<CapsuleSidebarActions | null>(null);

  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const orderedSeasonOptions = useMemo(() => sortSeasonOptions(seasonOptions), [seasonOptions]);
  const resolvedThemeMode = settingsProfile.theme === "dark"
    ? "dark"
    : settingsProfile.theme === "light"
      ? "light"
      : (prefersDarkMode ? "dark" : "light");
  const appTheme = useMemo(() => createAppTheme(resolvedThemeMode), [resolvedThemeMode]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePopState = () => {
      const nextRoute = getAppRoute(window.location.pathname);
      setAppRoute(nextRoute);
      if (nextRoute !== "explore") {
        setSearchInitialQuery("");
      }
      setPendingShareId(getShareIdFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const resolveErrorMessage = (error: { message?: string } | null | undefined) => {
    if (!error) return t("errors.generic");
    if (error.message === "invalid_email") return t("errors.invalidEmail");
    if (error.message === "cooldown") return t("errors.cooldown");
    if (error.message === "rate_limit") return t("errors.rateLimit");
    if (error.message === "expired") return t("errors.expired");
    if (error.message === "max_attempts") return t("errors.maxAttempts");
    if (error.message === "invalid") return t("errors.invalidCode");
    if (error.message === "profile_exists") return t("errors.profileExists");
    if (error.message === "not_found") return t("errors.profileNotFound");
    if (error.message === "invalid_payload") return t("errors.invalidPayload");
    if (error.message === "invalid_google_token") return t("errors.invalidGoogleToken");
    if (error.message === "google_auth_not_configured") return t("errors.googleAuthNotConfigured");
    if (error.message === "passkey_not_supported") return t("errors.passkeyNotSupported");
    if (error.message === "passkey_registration_failed") return t("errors.passkeySetupFailed");
    if (error.message === "passkey_login_failed") return t("errors.passkeyLoginFailed");
    if (error.message === "passkey_failed") return t("errors.passkeyLoginFailed");
    if (error.message === "passkey_cancelled") return "";
    if (error.message === "capsule_not_shareable") return t("errors.capsuleNotShareable");
    if (error.message === "shared_capsule_unavailable") return t("errors.sharedCapsuleUnavailable");
    return t("errors.generic");
  };

  const isNotificationApiSupported = () => (
    typeof window !== "undefined" && typeof window.Notification === "function"
  );

  const getNotificationPermission = () => (
    isNotificationApiSupported() ? window.Notification.permission : "unsupported"
  );

  const closeNotificationPrompt = () => {
    setNotificationPrompt(initialNotificationPrompt);
  };

  const closePasskeyPrompt = () => {
    setPasskeyPrompt(initialPasskeyPrompt);
  };

  const dismissPasskeyPrompt = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY, "true");
    }
    closePasskeyPrompt();
  };

  const shouldSkipPasskeyPrompt = () => (
    typeof window !== "undefined" &&
    window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY) === "true"
  );

  const maybeShowPasskeyPrompt = async () => {
    if (!isPasskeySupported() || shouldSkipPasskeyPrompt()) {
      return;
    }

    try {
      const response = await listPasskeys() as { passkeys?: unknown[] };
      if (Array.isArray(response.passkeys) && response.passkeys.length === 0) {
        setPasskeyPrompt({ open: true, loading: false });
      }
    } catch {
      // Prompting for passkeys is opportunistic; login should not fail if this read fails.
    }
  };

  const handleAddPasskeyFromPrompt = async () => {
    setPasskeyPrompt({ open: true, loading: true });
    try {
      await registerPasskey();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY, "true");
      }
      setPasskeyPrompt(initialPasskeyPrompt);
      setStatus({ loading: false, error: "", infoKey: "passkeys.added", infoParams: null });
    } catch (error) {
      const message = error instanceof Error && error.message === "passkey_cancelled"
        ? ""
        : resolveErrorMessage(error);
      setPasskeyPrompt({ open: Boolean(message), loading: false });
      if (message) {
        setStatus({ loading: false, error: message, infoKey: "", infoParams: null });
      }
    }
  };

  const shouldShowNotificationPrompt = (llm = settingsProfile.llm) => (
    llm !== "none" && getNotificationPermission() === "default"
  );

  const startPendingNotificationFlow = (kind: string, llm = settingsProfile.llm) => {
    pendingNotificationKindRef.current = kind;

    if (shouldShowNotificationPrompt(llm)) {
      setNotificationPrompt({ open: true });
      return;
    }

    closeNotificationPrompt();
  };

  const requestBrowserNotificationPermission = async () => {
    if (!isNotificationApiSupported()) {
      return "unsupported";
    }

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== "default") {
        closeNotificationPrompt();
      }
      return permission;
    } catch {
      return getNotificationPermission();
    }
  };

  const sendReadyNotification = (kind: string) => {
    if (getNotificationPermission() !== "granted") {
      return;
    }

    const bodyKey = kind === "partial"
      ? "notifications.ready.partialBody"
      : kind === "image"
        ? "notifications.ready.imageBody"
        : "notifications.ready.fullBody";

    try {
      new window.Notification(t("notifications.ready.title"), {
        body: t(bodyKey)
      });
    } catch {
      // Ignore browser-level notification errors and keep the UI responsive.
    }
  };

  useEffect(() => {
    let isActive = true;
    const bootstrapSession = async () => {
      setIsCheckingSession(true);
      try {
        const current = await fetchCurrentUser() as CurrentUserResponse;
        if (!isActive) return;
        setUser(current.user);
        const profileStatus = await fetchProfileStatus() as ProfileStatusResponse;
        if (!isActive) return;
        setHasProfile(profileStatus.hasProfile);
        setProfileCreated(profileStatus.hasProfile);
        if (!profileStatus.hasProfile) {
          await preloadOnboardingOptions();
          if (!isActive) return;
        } else {
          await Promise.all([ensureOptionsLoaded(), bootstrapCapsules(current.user?.email)]);
          if (!isActive) return;
        }
      } catch (error) {
        if (!isActive) return;
        setUser(null);
        setHasProfile(false);
        setSettingsProfile(normalizeProfileSettings());
      } finally {
        if (!isActive) return;
        setIsCheckingSession(false);
        setSessionInitialized(true);
      }
    };

    bootstrapSession();

    return () => {
      isActive = false;
    };
  }, []);

  const preloadOnboardingOptions = async ({ useFallback = false }: { useFallback?: boolean } = {}) => {
    try {
      const result = await loadProfileOptions() as ProfileOptionsResult;
      setStyleOptions(result.styles);
      setOccasionOptions(result.occasions);
      setSeasonOptions(result.seasons);
      setAudienceOptions(result.audience);
      setPatternOptions(result.patterns);
    } catch (error) {
      if (useFallback) {
        setStyleOptions(FALLBACK_STYLE_OPTIONS);
        setOccasionOptions(FALLBACK_OCCASION_OPTIONS);
        setSeasonOptions(FALLBACK_SEASON_OPTIONS);
        setAudienceOptions(FALLBACK_AUDIENCE_OPTIONS);
        setPatternOptions([]);
        return;
      }
      throw error;
    }
  };

  const ensureOptionsLoaded = async ({ useFallback = false }: { useFallback?: boolean } = {}) => {
    if (
      styleOptions &&
      Array.isArray(styleOptions.core) &&
      Array.isArray(styleOptions.aesthetics) &&
      occasionOptions.length > 0 &&
      seasonOptions.length > 0 &&
      audienceOptions.length > 0 &&
      Array.isArray(patternOptions)
    ) {
      return;
    }
    await preloadOnboardingOptions({ useFallback });
  };

  const clearWardrobeProgressState = () => {
    stopCapsuleEventStream();
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    manualWardrobeRegenerationCapsuleIdRef.current = "";
    pendingNotificationKindRef.current = "";
    closeNotificationPrompt();
    setPartialRegenerationPendingUrls([]);
    setPendingImageSetIndexes([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setIsLoadingItems(false);
  };

  const applyCapsuleState = (capsule: CapsuleMeta | null | undefined, { capsules = null as CapsuleMeta[] | null } = {}) => {
    if (!capsule) {
      return;
    }

    clearWardrobeProgressState();
    const effective = getEffectiveCapsule(capsule) || buildEmptyCapsuleDraft();
    setActiveCapsuleId(capsule.id || "");
    setActiveCapsuleMeta({
      ...capsule,
      status: capsule.status || buildCapsuleStatus(capsule)
    });
    setSelectedFormalityLevel(effective.filters?.formalityLevel || "");
    setSelectedStyle(effective.filters?.style ?? null);
    setSelectedOccasions(effective.filters?.occasions || []);
    setSelectedSeason(effective.filters?.season || []);
    setSelectedAudience(effective.filters?.audience || "");
    setSelectedColor(effective.filters?.color ?? null);
    setSelectedPattern(
      typeof effective.filters?.pattern === "string" && effective.filters.pattern.trim().length > 0
        ? effective.filters.pattern
        : "solid"
    );
    setSelectedText(effective.filters?.text || "");
    setProfileItems(buildDisplayWardrobeItems(effective.data?.wardrobe?.items || []) as WardrobeItem[]);
    setProfileOutfitSets(normalizeOutfitSets(effective.data?.wardrobe?.outfitSets));
    setPendingImageSetIndexes([]);
    setWardrobeLoadedCapsuleId(hasStoredWardrobeItems(capsule) ? capsule.id || "" : "");

    if (Array.isArray(capsules)) {
      setCapsuleList(capsules);
    }
  };

  const buildCurrentDraftSnapshot = ({
    wardrobe = {
      items: profileItems,
      outfitSets: profileOutfitSets
    },
    rejectedUrls = null
  }: {
    wardrobe?: CapsuleWardrobeData | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] } | null;
    rejectedUrls?: string[] | null;
  } = {}): CapsuleDraft => ({
    filters: {
      formalityLevel: selectedFormalityLevel,
      style: selectedStyle,
      occasions: selectedOccasions,
      season: selectedSeason,
      audience: selectedAudience,
      color: selectedColor,
      pattern: selectedPattern,
      text: selectedText
    },
    data: {
      wardrobe: wardrobe
        ? {
          items: Array.isArray(wardrobe.items) ? wardrobe.items : [],
          outfitSets: normalizeOutfitSets(wardrobe.outfitSets),
          ...getWardrobeMetadata(wardrobe as CapsuleWardrobeData)
        }
        : null,
      rejectedUrls: Array.isArray(rejectedUrls)
        ? rejectedUrls
        : getEffectiveCapsule(activeCapsuleMeta)?.data?.rejectedUrls || []
    }
  });

  const restoreCapsuleSnapshot = async (
    capsuleId: string | undefined,
    snapshot: WardrobeSnapshot | undefined,
    { shouldResumeEvents = false }: { shouldResumeEvents?: boolean } = {}
  ) => {
    if (!snapshot) {
      return;
    }

    await applyWardrobeSnapshot(snapshot, capsuleId);
    if (snapshot.status === "pending" && shouldResumeEvents) {
      startCapsuleEventStream(capsuleId);
    }
  };

  const bootstrapCapsules = async (email = user?.email) => {
    const result = await fetchCapsuleBootstrap() as CapsuleBootstrapResponse;
    const normalizedProfile = normalizeProfileSettings(result.profile, email);
    setSettingsProfile(normalizedProfile);
    if (normalizedProfile.locale) {
      setLocale(normalizedProfile.locale);
    }
    applyCapsuleState(result.activeCapsule, { capsules: result.capsules || [] });
    await restoreCapsuleSnapshot(result.activeCapsule?.id, result.activeSnapshot, { shouldResumeEvents: true });
    return normalizedProfile;
  };

  const handleRequestCode = async (event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await requestLoginCode(email.trim(), locale) as AuthResultResponse;
      setStatus({
        loading: false,
        error: "",
        infoKey: "auth.codeSent",
        infoParams: { minutes: Math.max(1, Math.ceil((Number(result?.expiresInMs) || 10 * 60000) / 60000)) }
      });
      setStep("code");
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
      setCode("");
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await verifyLoginCode(email.trim(), code.trim()) as AuthResultResponse;
      const profileStatus = await retry(() => fetchProfileStatus() as Promise<ProfileStatusResponse>);
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions({ useFallback: true });
        setUser(result.user);
        setSettingsProfile(normalizeProfileSettings({}, result.user?.email));
        setSelectedFormalityLevel("");
        setSelectedStyle(null);
        setSelectedOccasions([]);
        setSelectedSeason([]);
        setSelectedAudience("");
        setSelectedColor(null);
        setSelectedPattern("solid");
        setSelectedText("");
        setOnboardingStep(0);
        setStatus({ loading: false, error: "", infoKey: "", infoParams: null });
      } else {
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), bootstrapCapsules(result.user?.email)]);
        setUser(result.user);
        setStatus({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
        void maybeShowPasskeyPrompt();
      }
    } catch (error) {
      setUser(null);
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
      setCode("");
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await signInWithGoogle(idToken) as AuthResultResponse;
      const profileStatus = await retry(() => fetchProfileStatus() as Promise<ProfileStatusResponse>);
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions({ useFallback: true });
        setUser(result.user);
        setSettingsProfile(normalizeProfileSettings({}, result.user?.email));
        setSelectedFormalityLevel("");
        setSelectedStyle(null);
        setSelectedOccasions([]);
        setSelectedSeason([]);
        setSelectedAudience("");
        setSelectedColor(null);
        setSelectedPattern("solid");
        setSelectedText("");
        setOnboardingStep(0);
        setStatus({ loading: false, error: "", infoKey: "", infoParams: null });
      } else {
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), bootstrapCapsules(result.user?.email)]);
        setUser(result.user);
        setStatus({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
        void maybeShowPasskeyPrompt();
      }
    } catch (error) {
      setUser(null);
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handlePasskeySignIn = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await authenticateWithPasskey() as AuthResultResponse;
      clearRequestCache();
      const profileStatus = await retry(() => fetchProfileStatus() as Promise<ProfileStatusResponse>);
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions({ useFallback: true });
        setUser(result.user);
        setSettingsProfile(normalizeProfileSettings({}, result.user?.email));
        setSelectedFormalityLevel("");
        setSelectedStyle(null);
        setSelectedOccasions([]);
        setSelectedSeason([]);
        setSelectedAudience("");
        setSelectedColor(null);
        setSelectedPattern("solid");
        setSelectedText("");
        setOnboardingStep(0);
      } else {
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), bootstrapCapsules(result.user?.email)]);
        setUser(result.user);
      }
      setStatus({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
    } catch (error) {
      const message = resolveErrorMessage(error);
      setStatus({ loading: false, error: message, infoKey: "", infoParams: null });
    }
  };

  const handleRequestSignOut = () => {
    setIsSignOutConfirmOpen(true);
  };

  const handleLogout = async () => {
    setIsSignOutConfirmOpen(false);
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await logout();
      clearRequestCache();
      setUser(null);
      setHasProfile(false);
      setProfileCreated(false);
      setSettingsProfile(normalizeProfileSettings());
      setCurrentView("main");
      setStep("email");
      setEmail("");
      setCode("");
      setSelectedFormalityLevel("");
      setSelectedStyle(null);
      setSelectedOccasions([]);
      setSelectedSeason([]);
      setSelectedAudience("");
      setSelectedColor(null);
      setSelectedPattern("solid");
      setSelectedText("");
      setOnboardingStep(0);
      setProfileItems(null);
      setProfileOutfitSets([]);
      setPendingImageSetIndexes([]);
      setActiveCapsuleId("");
      setActiveCapsuleMeta(null);
      setCapsuleList([]);
      setIsLoadingItems(false);
      setIsDownloadingWardrobePdf(false);
      setWardrobeLoadedCapsuleId("");
      setSelectedRegenerationUrls([]);
      setPartialRegenerationPendingUrls([]);
      setIsPartialRegenerationLoading(false);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      pendingRegenerationUrlsRef.current = [];
      regenerationBaseItemsRef.current = [];
      manualWardrobeRegenerationCapsuleIdRef.current = "";
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      clearProfileOptionsCache();
      setStyleOptions(FALLBACK_STYLE_OPTIONS);
      setOccasionOptions([]);
      setSeasonOptions([]);
      setAudienceOptions([]);
      setPatternOptions([]);
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.history.replaceState({}, "", "/");
      }
      setAppRoute("capsule");
      setStatus({ loading: false, error: "", infoKey: "auth.signedOut", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const resetToEmail = () => {
    setStep("email");
    setCode("");
    setStatus(initialStatus);
  };

  const toggleSelection = (value, selected, setter) => {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value));
    } else {
      setter([...selected, value]);
    }
  };

  const handleNextOnboarding = () => {
    if (onboardingStep === 0 && !selectedFormalityLevel) return;
    if (onboardingStep === 1 && selectedOccasions.length === 0) return;
    if (onboardingStep === 2 && selectedSeason.length === 0) return;
    if (onboardingStep === 3 && !selectedAudience) return;
    setOnboardingStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBackOnboarding = () => {
    setOnboardingStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinishOnboarding = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await initializeProfile(locale);
      const createdCapsuleResult = await createCapsule({
        filters: buildCurrentDraftSnapshot({ wardrobe: null, rejectedUrls: [] }).filters
      }) as CapsuleMutationResponse;
      const createdCapsuleId = String(createdCapsuleResult?.capsule?.id || "").trim();
      setProfileCreated(true);
      setHasProfile(true);
      setCurrentView("main");
      setProfileItems(null);
      setProfileOutfitSets([]);
      setPendingImageSetIndexes([]);
      setSelectedRegenerationUrls([]);
      setPartialRegenerationPendingUrls([]);
      setIsPartialRegenerationLoading(false);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      const normalizedProfile = await bootstrapCapsules(user?.email);
      if (createdCapsuleId) {
        manualWardrobeRegenerationCapsuleIdRef.current = createdCapsuleId;
        setIsLoadingItems(true);
        const response = await requestWardrobeRegeneration({ capsuleId: createdCapsuleId }) as WardrobeMutationResponse;
        if (response?.status === "pending") {
          startPendingNotificationFlow("full", normalizedProfile?.llm);
          startCapsuleEventStream(createdCapsuleId);
        } else {
          setIsLoadingItems(false);
        }
      }
      setStatus({ loading: false, error: "", infoKey: "onboarding.completedHint", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleSaveProfile = async () => {
    await handleApplyCapsuleFilters();
  };

  const handleSaveSettings = async (nextSettings: SettingsSavePayload) => {
    const payload = {
      locale: String(nextSettings?.locale || settingsProfile.locale || locale || "en").trim().toLowerCase(),
      theme: String(nextSettings?.theme || settingsProfile.theme || DEFAULT_PROFILE_THEME).trim().toLowerCase(),
      llm: String(nextSettings?.llm || settingsProfile.llm || DEFAULT_PROFILE_LLM).trim(),
      image_llm: String(nextSettings?.image_llm || settingsProfile.imageLlm || DEFAULT_PROFILE_IMAGE_LLM).trim(),
      fullname: typeof nextSettings?.fullname === "string" ? nextSettings.fullname.trim() : ""
    };

    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await updateProfile(payload) as { profile?: Partial<ProfileSettings> };
      const normalizedProfile = normalizeProfileSettings(result.profile, user?.email);
      setSettingsProfile(normalizedProfile);
      if (normalizedProfile.locale && normalizedProfile.locale !== locale) {
        setLocale(normalizedProfile.locale);
      }
      setStatus({ loading: false, error: "", infoKey: "settings.saved", infoParams: null });
      return normalizedProfile;
    } catch (error) {
      const message = resolveErrorMessage(error);
      setStatus({ loading: false, error: message, infoKey: "", infoParams: null });
      throw new Error(message);
    }
  };

  const refreshCapsuleList = async () => {
    const result = await fetchRecentCapsules() as CapsuleListResponse;
    setCapsuleList(result.capsules || []);
  };

  const handleApplyCapsuleFilters = async () => {
    if (!activeCapsuleId) {
      return;
    }

    setIsContentOperationLoading(true);
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const nextFilters = buildCurrentDraftSnapshot().filters;
      const result = await updateCapsuleFilters(activeCapsuleId, nextFilters, { regenerate: true }) as CapsuleMutationResponse;
      setActiveCapsuleMeta((current) => result?.capsule || (
        current
          ? {
            ...current,
            draft: {
              filters: nextFilters,
              data: {
                wardrobe: null,
                rejectedUrls: []
              }
            }
          }
          : current
      ));
      setProfileItems([]);
      setProfileOutfitSets([]);
      setPendingImageSetIndexes([]);
      setWardrobeLoadedCapsuleId("");
      manualWardrobeRegenerationCapsuleIdRef.current = activeCapsuleId;
      await refreshCapsuleList();
      setIsLoadingItems(true);
      if (result?.status === "pending") {
        startPendingNotificationFlow("full");
        startCapsuleEventStream(activeCapsuleId);
      } else {
        setIsLoadingItems(false);
      }
      setStatus({ loading: false, error: "", infoKey: "profile.updated", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleCreateCapsule = async () => {
    setIsContentOperationLoading(true);
    try {
      const result = await createCapsule({ filters: buildEmptyCapsuleDraft().filters }) as CapsuleMutationResponse;
      applyCapsuleState(result.capsule);
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleOpenCapsule = async (capsuleId: string) => {
    setIsContentOperationLoading(true);
    try {
      const result = await fetchCapsule(capsuleId) as { capsule?: CapsuleMeta | null; snapshot?: WardrobeSnapshot };
      applyCapsuleState(result.capsule);
      await restoreCapsuleSnapshot(result.capsule?.id, result.snapshot, { shouldResumeEvents: true });
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleSaveCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await saveCapsule(capsuleId) as CapsuleMutationResponse;
      if (capsuleId === activeCapsuleId) {
        setActiveCapsuleMeta(result.capsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleRevertCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await revertCapsule(capsuleId) as CapsuleMutationResponse;
      if (capsuleId === activeCapsuleId) {
        applyCapsuleState(result.capsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleRenameCapsule = async (name: string, capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await renameCapsule(capsuleId, name) as CapsuleMutationResponse;
      if (capsuleId === activeCapsuleId) {
        setActiveCapsuleMeta(result.capsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleDuplicateCapsule = async (name: string, capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await duplicateCapsule(capsuleId, name) as CapsuleMutationResponse;
      applyCapsuleState(result.capsule);
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleDeleteCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await deleteCapsule(capsuleId) as CapsuleMutationResponse;
      if (result.activeCapsule) {
        applyCapsuleState(result.activeCapsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleSearchCapsules = async (query: string) => {
    const result = await searchCapsules(query) as CapsuleListResponse;
    return result.capsules || [];
  };

  const handleResetProfileFilters = async () => {
    setStatus(initialStatus);
    setSelectedRegenerationUrls([]);
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setIsContentOperationLoading(true);
    try {
      if (!activeCapsuleId) {
        return;
      }
      const result = await fetchCapsule(activeCapsuleId);
      applyCapsuleState(result.capsule);
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await deleteProfile();
      await handleLogout();
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleBackToMain = () => {
    setCurrentView("main");
  };

  const clearShareRoute = () => {
    setPendingShareId("");
    setShareMetadata(null);
    setIsShareDialogOpen(false);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/share/")) {
      window.history.replaceState({}, "", "/");
    }
    setAppRoute("capsule");
  };

  const handleShareCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return {};
    }
    try {
      return await shareCapsule(capsuleId) as { url?: string; expiresAt?: string | Date };
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
      return {};
    }
  };

  const handleImportSharedCapsule = async () => {
    const shareId = String(shareMetadata?.id || pendingShareId || "").trim();
    if (!shareId) {
      return;
    }
    setIsShareLoading(true);
    try {
      const result = await importSharedCapsule(shareId) as CapsuleMutationResponse;
      if (result.capsule) {
        applyCapsuleState(result.capsule);
      }
      await refreshCapsuleList();
      setStatus({ loading: false, error: "", infoKey: "capsule.shareImported", infoParams: null });
      clearShareRoute();
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
      clearShareRoute();
    } finally {
      if (isMountedRef.current) {
        setIsShareLoading(false);
      }
    }
  };

  const handleNavigateApp = (nextApp: Exclude<AppRoute, "share">, options: AppNavigationOptions = {}) => {
    if (typeof window === "undefined") {
      return;
    }
    const nextPath = nextApp === "explore"
      ? "/explore"
      : nextApp === "statistics"
        ? "/statistics"
        : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setSearchInitialQuery(nextApp === "explore" ? String(options.query || "") : "");
    setAppRoute(getAppRoute(nextPath));
  };

  const registerCapsuleSidebarActions = (actions: CapsuleSidebarActions | null) => {
    capsuleSidebarActionsRef.current = actions;
  };

  const getActiveSidebarApp = (): "capsule" | "explore" | "statistics" => (
    appRoute === "explore" || appRoute === "statistics" ? appRoute : "capsule"
  );

  const handleCreateCapsuleFromSidebar = async (onComplete?: () => void) => {
    await handleCreateCapsule();
    handleNavigateApp("capsule");
    onComplete?.();
  };

  const handleOpenCapsuleFromSidebar = async (capsuleId: string, onComplete?: () => void) => {
    handleNavigateApp("capsule");
    await handleOpenCapsule(capsuleId);
    onComplete?.();
  };

  useEffect(() => {
    if (!sessionInitialized || !pendingShareId || !user || !(hasProfile || profileCreated)) {
      return;
    }

    let isActive = true;
    setIsShareLoading(true);
    fetchSharedCapsule(pendingShareId)
      .then((metadata) => {
        if (!isActive || !isMountedRef.current) {
          return;
        }
        setShareMetadata(metadata as ShareMetadata);
        setIsShareDialogOpen(true);
      })
      .catch((error) => {
        if (!isActive || !isMountedRef.current) {
          return;
        }
        setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
        clearShareRoute();
      })
      .finally(() => {
        if (isActive && isMountedRef.current) {
          setIsShareLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [sessionInitialized, pendingShareId, user, hasProfile, profileCreated]);

  const isSignInView = !user;
  const isSearchView = Boolean(user && (hasProfile || profileCreated) && appRoute === "explore");
  const isStatisticsView = Boolean(user && (hasProfile || profileCreated) && appRoute === "statistics");
  const isMainScreenView = Boolean(
    user && (hasProfile || profileCreated) && currentView === "main" && (appRoute === "capsule" || appRoute === "share")
  );
  const isOnboardingView = Boolean(user && !hasProfile && !profileCreated);
  const hasBrandedPanelHeader = isSignInView || isMainScreenView || isOnboardingView || isSearchView || isStatisticsView;
  const canGenerateWardrobe = Boolean(
    selectedFormalityLevel &&
    selectedOccasions.length > 0 &&
    selectedSeason.length > 0 &&
    selectedAudience
  );
  const hasFilterChanges = !areFiltersEqual(
    buildCurrentDraftSnapshot({ wardrobe: null }).filters,
    getEffectiveCapsule(activeCapsuleMeta)?.filters || buildEmptyCapsuleDraft().filters
  );
  const isContentBusy = (
    isLoadingItems
    || isWardrobePending
    || isPartialRegenerationLoading
    || isContentOperationLoading
    || isDownloadingWardrobePdf
    || pendingImageSetIndexes.length > 0
  );

  const logWardrobeSelection = (rawSelectionText) => {
    if (typeof rawSelectionText !== "string" || rawSelectionText.trim().length === 0) {
      return;
    }

    try {
      console.log("[wardrobe-ai][selection]", JSON.parse(rawSelectionText));
    } catch {
      console.log("[wardrobe-ai][selection]", rawSelectionText);
    }
  };

  const handleWardrobeError = () => {
    setProfileItems([]);
    setProfileOutfitSets([]);
    setPendingImageSetIndexes([]);
    setWardrobeLoadedCapsuleId(activeCapsuleId);
    setSelectedRegenerationUrls([]);
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setIsLoadingItems(false);
  };

  const stopCapsuleEventStream = () => {
    if (!capsuleEventsAbortRef.current) {
      return;
    }

    capsuleEventsAbortRef.current.abort();
    capsuleEventsAbortRef.current = null;
  };

  const applyWardrobeSnapshot = async (snapshot: WardrobeSnapshot | undefined, capsuleId: string | undefined = activeCapsuleId) => {
    const normalizedCapsuleId = String(capsuleId || "").trim();
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const outfitSets = normalizeOutfitSets(snapshot?.outfitSets);
    const pendingRegenerationUrls = Array.isArray(snapshot?.pendingRegenerationUrls)
      ? snapshot.pendingRegenerationUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
      : [];
    const nextPendingImageSetIndexes = Array.isArray(snapshot?.pendingImageSetIndexes)
      ? snapshot.pendingImageSetIndexes
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value >= 0)
      : [];
    const isPending = snapshot?.status === "pending";
    const isPendingExtras = Boolean(snapshot?.hasPendingAdditionalItems);
    const hasPendingOutfitSetImages = nextPendingImageSetIndexes.length > 0;

    if (snapshot?.status === "failed") {
      manualWardrobeRegenerationCapsuleIdRef.current = "";
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      stopCapsuleEventStream();
      setProfileItems(buildDisplayWardrobeItems(items) as WardrobeItem[]);
      setProfileOutfitSets(outfitSets);
      setSelectedRegenerationUrls([]);
      pendingRegenerationUrlsRef.current = [];
      regenerationBaseItemsRef.current = [];
      setPartialRegenerationPendingUrls([]);
      setIsPartialRegenerationLoading(false);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      setIsLoadingItems(false);
      setPendingImageSetIndexes(nextPendingImageSetIndexes);
      setWardrobeLoadedCapsuleId(normalizedCapsuleId);
      setStatus((current) => ({
        ...current,
        error: t("errors.regenerateAllFailed")
      }));
      return;
    }

    if (isPending) {
      setProfileItems((currentItems) => (
        pendingRegenerationUrls.length > 0
          ? mergeWardrobeItemsIntoExistingOrder({
            currentItems,
            nextItems: items,
            pendingUrls: pendingRegenerationUrls
          }) as WardrobeItem[]
          : buildDisplayWardrobeItems(items) as WardrobeItem[]
      ));
      setSelectedRegenerationUrls([]);
      pendingRegenerationUrlsRef.current = pendingRegenerationUrls;
      setPartialRegenerationPendingUrls(pendingRegenerationUrls);
      setIsPartialRegenerationLoading(pendingRegenerationUrls.length > 0);
      setProfileOutfitSets(outfitSets);
      setPendingImageSetIndexes(nextPendingImageSetIndexes);
      setIsWardrobePending(true);
      setHasPendingAdditionalItems(isPendingExtras);
      setIsLoadingItems(items.length === 0 && !isPendingExtras);
      return;
    }

    logWardrobeSelection(snapshot?.rawSelectionText);
    const currentPendingUrls = pendingRegenerationUrlsRef.current;
    const baseItems = currentPendingUrls.length > 0 ? regenerationBaseItemsRef.current : [];
    setProfileItems((currentItems) => (
      currentPendingUrls.length > 0
        ? mergeWardrobeItemsIntoExistingOrder({
          currentItems: baseItems.length > 0 ? baseItems : currentItems,
          nextItems: items,
          pendingUrls: currentPendingUrls
        }) as WardrobeItem[]
        : buildDisplayWardrobeItems(items) as WardrobeItem[]
    ));
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    setProfileOutfitSets(outfitSets);
    setPendingImageSetIndexes(nextPendingImageSetIndexes);
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setIsLoadingItems(false);
    setWardrobeLoadedCapsuleId(snapshot?.status === "ready" ? normalizedCapsuleId : "");

    if (snapshot?.status !== "pending" && !hasPendingOutfitSetImages) {
      manualWardrobeRegenerationCapsuleIdRef.current = "";
      stopCapsuleEventStream();
    }

    if (snapshot?.status === "ready" && !hasPendingOutfitSetImages && normalizedCapsuleId) {
      const pendingNotificationKind = pendingNotificationKindRef.current;
      if (pendingNotificationKind) {
        sendReadyNotification(pendingNotificationKind);
      }
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      try {
        const capsuleResult = await fetchCapsule(normalizedCapsuleId);
        setActiveCapsuleMeta(capsuleResult.capsule);
        await refreshCapsuleList();
      } catch {
        // Keep rendered items even if sidebar metadata refresh fails.
      }
    }
  };

  const startCapsuleEventStream = (capsuleId: string | undefined) => {
    const normalizedCapsuleId = String(capsuleId || "").trim();
    if (!normalizedCapsuleId) {
      return Promise.resolve();
    }

    stopCapsuleEventStream();
    const abortController = new AbortController();
    capsuleEventsAbortRef.current = abortController;

    return subscribeCapsuleEvents({
      capsuleId: normalizedCapsuleId,
      signal: abortController.signal,
      onMessage(event) {
        if (event.event !== "snapshot" || !isMountedRef.current) {
          return;
        }

        applyWardrobeSnapshot(event.data, normalizedCapsuleId).catch(() => {
          if (!isMountedRef.current) {
            return;
          }
          stopCapsuleEventStream();
          pendingNotificationKindRef.current = "";
          closeNotificationPrompt();
          handleWardrobeError();
        });
      },
      onError(error) {
        if (!isMountedRef.current) {
          return;
        }
        stopCapsuleEventStream();
        pendingNotificationKindRef.current = "";
        closeNotificationPrompt();
        handleWardrobeError();
        setStatus((current) => ({
          ...current,
          error: resolveErrorMessage(error)
        }));
      }
    }).catch((error) => {
      if (abortController.signal.aborted || !isMountedRef.current) {
        return;
      }
      stopCapsuleEventStream();
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      handleWardrobeError();
      setStatus((current) => ({
        ...current,
        error: resolveErrorMessage(error)
      }));
    });
  };

  const handleRefreshWardrobe = async () => {
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    manualWardrobeRegenerationCapsuleIdRef.current = activeCapsuleId;
    stopCapsuleEventStream();
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setWardrobeLoadedCapsuleId("");
    setIsLoadingItems(true);
    try {
      const response = await requestWardrobeRegeneration({ capsuleId: activeCapsuleId }) as WardrobeMutationResponse;
      if (response?.status === "pending") {
        startPendingNotificationFlow("full");
        startCapsuleEventStream(activeCapsuleId);
      } else {
        setIsLoadingItems(false);
      }
    } catch (error) {
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      handleWardrobeError();
      setStatus((current) => ({
        ...current,
        error: resolveErrorMessage(error)
      }));
    }
  };

  const handleDownloadWardrobePdf = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsDownloadingWardrobePdf(true);
    try {
      await downloadCapsulePdf(capsuleId);
    } catch {
      setStatus((current) => ({
        ...current,
        error: t("errors.downloadFailed")
      }));
    } finally {
      if (isMountedRef.current) {
        setIsDownloadingWardrobePdf(false);
      }
    }
  };

  const handleToggleRegenerationSelection = (item: WardrobeItem) => {
    const itemUrl = String(item?.url || "").trim();
    if (!itemUrl || isPartialRegenerationLoading) {
      return;
    }

    setSelectedRegenerationUrls((current) => (
      current.includes(itemUrl)
        ? current.filter((url) => url !== itemUrl)
        : [...current, itemUrl]
    ));
  };

  const handleCancelRegenerationSelection = () => {
    setSelectedRegenerationUrls([]);
  };

  const handleRegenerateSelectedItems = async () => {
    if (selectedRegenerationUrls.length === 0 || isPartialRegenerationLoading || !activeCapsuleId) {
      return;
    }

    const pendingUrls = [...selectedRegenerationUrls];
    const existingItems = Array.isArray(profileItems) ? profileItems : [];
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = pendingUrls;
    regenerationBaseItemsRef.current = existingItems;
    setPartialRegenerationPendingUrls(pendingUrls);
    setIsPartialRegenerationLoading(true);

    try {
      const response = await requestSelectedWardrobeRegeneration({ itemUrls: pendingUrls, capsuleId: activeCapsuleId }) as WardrobeMutationResponse;
      if (response?.status === "pending") {
        startPendingNotificationFlow("partial");
        startCapsuleEventStream(activeCapsuleId);
      } else {
        setIsPartialRegenerationLoading(false);
      }
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setProfileItems(existingItems);
      pendingRegenerationUrlsRef.current = [];
      regenerationBaseItemsRef.current = [];
      setPartialRegenerationPendingUrls([]);
      setIsPartialRegenerationLoading(false);
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      setStatus((current) => ({
        ...current,
        error: error?.message === "invalid_payload"
          ? resolveErrorMessage(error)
          : t("errors.regenerateSelectedFailed")
      }));
    }
  };

  const handleGenerateOutfitSetImage = async (setIndex: number | string | null | undefined) => {
    const normalizedSetIndex = Number.parseInt(String(setIndex ?? ""), 10);
    if (!activeCapsuleId || !Number.isInteger(normalizedSetIndex) || normalizedSetIndex < 0) {
      return;
    }

    setPendingImageSetIndexes((current) => (
      current.includes(normalizedSetIndex)
        ? current
        : [...current, normalizedSetIndex].sort((left, right) => left - right)
    ));

    try {
      const response = await requestOutfitSetImageGeneration({
        capsuleId: activeCapsuleId,
        setIndex: normalizedSetIndex
      }) as WardrobeMutationResponse;
      if (response?.status === "pending") {
        startPendingNotificationFlow("image", settingsProfile.imageLlm);
        startCapsuleEventStream(activeCapsuleId);
        return;
      }

      setPendingImageSetIndexes((current) => current.filter((value) => value !== normalizedSetIndex));
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setPendingImageSetIndexes((current) => current.filter((value) => value !== normalizedSetIndex));
      pendingNotificationKindRef.current = "";
      closeNotificationPrompt();
      setStatus((current) => ({
        ...current,
        error: resolveErrorMessage(error)
      }));
    }
  };

  const handleDeleteOutfitSetImage = async (setIndex: number | string | null | undefined) => {
    const normalizedSetIndex = Number.parseInt(String(setIndex ?? ""), 10);
    if (!activeCapsuleId || !Number.isInteger(normalizedSetIndex) || normalizedSetIndex < 0) {
      return;
    }

    setIsContentOperationLoading(true);
    try {
      await requestOutfitSetImageDeletion({
        capsuleId: activeCapsuleId,
        setIndex: normalizedSetIndex
      });
      setProfileOutfitSets((current) => current.map((set, index) => (
        index === normalizedSetIndex
          ? {
            ...set,
            image: null,
            imageObsolete: false
          }
          : set
      )));
      startCapsuleEventStream(activeCapsuleId);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setStatus((current) => ({
        ...current,
        error: resolveErrorMessage(error)
      }));
    } finally {
      if (isMountedRef.current) {
        setIsContentOperationLoading(false);
      }
    }
  };

  useEffect(() => {
    pendingRegenerationUrlsRef.current = partialRegenerationPendingUrls;
  }, [partialRegenerationPendingUrls]);

  useEffect(() => () => {
    stopCapsuleEventStream();
    pendingNotificationKindRef.current = "";
  }, []);

  useEffect(() => {
    if (!sessionInitialized || !user || !(hasProfile || profileCreated)) {
      return;
    }
    if (!settingsProfile.locale || locale === settingsProfile.locale) {
      return;
    }
    updateProfileLocale(locale)
      .then(() => {
        if (isMountedRef.current) {
          setSettingsProfile((current) => ({ ...current, locale }));
        }
      })
      .catch(() => {});
  }, [locale, settingsProfile.locale, sessionInitialized, user, hasProfile, profileCreated]);

  const handleSaveSettingsFromScreen = async (nextSettings: SettingsSavePayload) => {
    await handleSaveSettings(nextSettings);
  };

  const renderRightPanel = () => {
    if (isCheckingSession || !sessionInitialized) {
      return null;
    }

    if (!user) {
      return (
        <SignInScreen
          step={step}
          email={email}
          code={code}
          status={status}
          googleClientId={GOOGLE_CLIENT_ID}
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onRequestCode={handleRequestCode}
          onVerifyCode={handleVerifyCode}
          onGoogleCredential={handleGoogleCredential}
          onPasskeySignIn={handlePasskeySignIn}
          onResetEmail={resetToEmail}
        />
      );
    }

    if (hasProfile || profileCreated) {
      if (appRoute === "explore") {
        return (
          <SearchScreen
            onNavigateApp={handleNavigateApp}
            initialQuery={searchInitialQuery}
          />
        );
      }

      if (appRoute === "statistics") {
        return (
          <StatisticsScreen
            onNavigateApp={handleNavigateApp}
          />
        );
      }

      if (currentView === "profile") {
        return (
          <ProfileScreen
            styleOptions={styleOptions}
            occasionOptions={occasionOptions}
            seasonOptions={orderedSeasonOptions}
            audienceOptions={audienceOptions}
            accentColorOptions={FALLBACK_ACCENT_COLOR_OPTIONS}
            patternOptions={patternOptions}
            selectedStyleCore={selectedFormalityLevel}
            selectedStyleAesthetic={selectedStyle}
            selectedOccasions={selectedOccasions}
            selectedSeasons={selectedSeason}
            selectedAudience={selectedAudience}
            selectedAccentColor={selectedColor}
          selectedPattern={selectedPattern}
          selectedText={selectedText}
          status={status}
            onSelectStyleCore={setSelectedFormalityLevel}
            onSelectStyleAesthetic={setSelectedStyle}
            onToggleOccasion={(value) =>
              toggleSelection(value, selectedOccasions, setSelectedOccasions)
            }
            onToggleSeason={(value) => toggleSelection(value, selectedSeason, setSelectedSeason)}
            onSelectAudience={setSelectedAudience}
            onSelectAccentColor={setSelectedColor}
          onSelectPattern={setSelectedPattern}
          onTextChange={setSelectedText}
          onSave={handleSaveProfile}
            onDelete={handleDeleteProfile}
            onBack={handleBackToMain}
          />
        );
      }

      return (
        <MainScreen
          activeCapsule={activeCapsuleMeta}
          capsuleList={capsuleList}
          userEmail={user?.email || ""}
          userName={settingsProfile.fullname}
          settingsProfile={settingsProfile}
          onSignOut={handleRequestSignOut}
          onSaveSettings={handleSaveSettingsFromScreen}
          isSigningOut={status.loading}
          onRefreshItems={handleRefreshWardrobe}
          onDownloadPdf={handleDownloadWardrobePdf}
          onCreateCapsule={handleCreateCapsule}
          onOpenCapsule={handleOpenCapsule}
          onSaveCapsule={handleSaveCapsule}
          onRevertCapsule={handleRevertCapsule}
          onRenameCapsule={handleRenameCapsule}
          onDuplicateCapsule={handleDuplicateCapsule}
          onDeleteCapsule={handleDeleteCapsule}
          onShareCapsule={handleShareCapsule}
          onSearchCapsules={handleSearchCapsules}
          items={profileItems || []}
          outfitSets={profileOutfitSets}
          isLoadingItems={isLoadingItems}
          isContentBusy={isContentBusy}
          isDownloadingPdf={isDownloadingWardrobePdf}
          showAdditionalItemPlaceholder={hasPendingAdditionalItems}
          styleOptions={styleOptions}
          occasionOptions={occasionOptions}
          seasonOptions={orderedSeasonOptions}
          audienceOptions={audienceOptions}
          accentColorOptions={FALLBACK_ACCENT_COLOR_OPTIONS}
          patternOptions={patternOptions}
          selectedStyleCore={selectedFormalityLevel}
          selectedStyleAesthetic={selectedStyle}
          selectedOccasions={selectedOccasions}
          selectedSeasons={selectedSeason}
          selectedAudience={selectedAudience}
          selectedAccentColor={selectedColor}
          selectedPattern={selectedPattern}
          selectedText={selectedText}
          hasFilterChanges={hasFilterChanges}
          status={status}
          onSelectStyleCore={setSelectedFormalityLevel}
          onSelectStyleAesthetic={setSelectedStyle}
          onToggleOccasion={(value) =>
            toggleSelection(value, selectedOccasions, setSelectedOccasions)
          }
          onToggleSeason={(value) => toggleSelection(value, selectedSeason, setSelectedSeason)}
          onSelectAudience={setSelectedAudience}
          onSelectAccentColor={setSelectedColor}
          onSelectPattern={setSelectedPattern}
          onTextChange={setSelectedText}
          onApplyFilters={handleApplyCapsuleFilters}
          onResetFilters={handleResetProfileFilters}
          onNavigateApp={handleNavigateApp}
          selectedRegenerationUrls={selectedRegenerationUrls}
          partialRegenerationPendingUrls={partialRegenerationPendingUrls}
          pendingImageSetIndexes={pendingImageSetIndexes}
          onToggleRegenerationSelection={handleToggleRegenerationSelection}
          onCancelRegenerationSelection={handleCancelRegenerationSelection}
          onRegenerateSelectedItems={handleRegenerateSelectedItems}
          onDeleteOutfitSetImage={handleDeleteOutfitSetImage}
          onGenerateOutfitSetImage={handleGenerateOutfitSetImage}
          isPartialRegenerationLoading={isPartialRegenerationLoading}
          registerCapsuleSidebarActions={registerCapsuleSidebarActions}
        />
      );
    }

    return (
      <OnboardingScreen
        onboardingStep={onboardingStep}
        styleOptions={styleOptions}
        occasionOptions={occasionOptions}
        seasonOptions={orderedSeasonOptions}
        audienceOptions={audienceOptions}
        selectedStyleCore={selectedFormalityLevel}
        selectedStyleAesthetic={selectedStyle}
        selectedOccasions={selectedOccasions}
        selectedSeasons={selectedSeason}
        selectedAudience={selectedAudience}
        status={status}
        onSelectStyleCore={setSelectedFormalityLevel}
        onSelectStyleAesthetic={setSelectedStyle}
        onToggleOccasion={(value) =>
          toggleSelection(value, selectedOccasions, setSelectedOccasions)
        }
        onToggleSeason={(value) => toggleSelection(value, selectedSeason, setSelectedSeason)}
        onSelectAudience={setSelectedAudience}
        onNext={handleNextOnboarding}
        onBack={handleBackOnboarding}
        onFinish={handleFinishOnboarding}
      />
    );
  };

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "stretch",
          backgroundColor: "background.default",
          // backgroundImage:
          //   'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
          position: "relative",
          overflow: "hidden",
          "&::before": { display: "none" },
          "&::after": { display: "none" }
        }}
      >
      <Container
        disableGutters={isMainScreenView || isSearchView || isStatisticsView}
        maxWidth={isMainScreenView || isSearchView || isStatisticsView ? false : "lg"}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: user ? "1fr" : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          py: (isMainScreenView || isSearchView || isStatisticsView) ? { xs: 0, md: "12px" } : { xs: 0, md: "24px" },
          px: (isMainScreenView || isSearchView || isStatisticsView) ? 0 : { xs: 0, md: 3 },
          maxWidth: (isMainScreenView || isSearchView || isStatisticsView) ? "none" : undefined,
          minHeight: "100vh",
          height: "100%",
          boxSizing: "border-box"
        }}
      >
        {!sessionInitialized ? null : !user ? (
          <Stack
            spacing={{ xs: 1.9, md: 2.2 }}
            sx={{ display: { xs: "none", md: "flex" }, pr: { md: 4 } }}
          >
            <Box
              sx={{
                width: { md: "92%", lg: "100%" },
                maxWidth: { md: 340, lg: 420 },
                ml: { md: -1, lg: -2 },
                mb: { md: -1.4, lg: -1.8 },
                overflow: "hidden",
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `
                    radial-gradient(circle at 50% 50%, rgba(252, 251, 249, 0) 62%, rgba(252, 251, 249, 0.07) 84%, rgba(252, 251, 249, 0.14) 100%),
                    linear-gradient(to top, rgba(252, 251, 249, 0.08), rgba(252, 251, 249, 0)),
                    linear-gradient(to bottom, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)),
                    linear-gradient(to right, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0)),
                    linear-gradient(to left, rgba(252, 251, 249, 0.07), rgba(252, 251, 249, 0))
                  `
                }
              }}
            >
              <Box component="picture" sx={{ display: "block" }}>
                <source srcSet="/girl.webp" type="image/webp" />
                <Box
                  component="img"
                  src="/girl.png"
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  {...({ fetchpriority: "high" } as Record<string, string>)}
                  sx={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    filter: "saturate(0.96) contrast(0.98)",
                    opacity: 0.98,
                    transform: "translateZ(0)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    imageRendering: "auto",
                    objectFit: "cover",
                    mixBlendMode: "multiply"
                  }}
                />
              </Box>
            </Box>
            <Typography
              variant={isLarge ? "h2" : "h3"}
              sx={{
                mt: { xs: 0.15, md: 0.1 },
                maxWidth: { xs: "14ch", md: "20ch" },
                fontSize: { xs: "1.46rem", sm: "1.7rem", md: "2rem", lg: "2.28rem" },
                lineHeight: { xs: 1.2, md: 1.16 },
                letterSpacing: "-0.015em",
                fontWeight: 600
              }}
            >
              {t("marketingHeadline")}
            </Typography>
          </Stack>
        ) : null}

        {!sessionInitialized ? null : (isMainScreenView || isSearchView || isStatisticsView) ? (
          <AppSidebarShell
            shellTestId={
              isSearchView
                ? "search-screen-shell"
                : isStatisticsView
                  ? "statistics-screen-shell"
                  : "main-screen-shell"
            }
            currentApp={getActiveSidebarApp()}
            userEmail={user?.email || ""}
            userName={settingsProfile.fullname}
            settingsProfile={settingsProfile}
            onSaveSettings={handleSaveSettingsFromScreen}
            onSignOut={handleRequestSignOut}
            headerContent={({ isOverlaySidebar, openSidebar }) => (
              <Box
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 3,
                  backgroundColor: "background.paper",
                  pb: 1.5
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    {isOverlaySidebar ? (
                      <IconButton
                        aria-label="Toggle sidebar"
                        onClick={openSidebar}
                        disabled={getActiveSidebarApp() === "capsule" && isContentBusy}
                      >
                        <MenuRoundedIcon />
                      </IconButton>
                    ) : null}
                    {!isOverlaySidebar ? (
                      <Typography
                        noWrap
                        sx={{
                          fontFamily: '"Leckerli One", cursive',
                          fontSize: "1.85rem",
                          lineHeight: 1.1,
                          color: "#8f6f45",
                          textAlign: "left"
                        }}
                      >
                        {t("appName")}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <LocaleSwitcher />
                  </Stack>
                </Stack>
              </Box>
            )}
            sidebarBodyContent={({ isOverlaySidebar, isSidebarCollapsed, desktopSidebarRailWidth, expandCollapsedSidebar, closeSidebar }) => {
              const activeSidebarApp = getActiveSidebarApp();
              return (
                <AppSidebarNavigation
                  activeApp={activeSidebarApp}
                  isOverlaySidebar={isOverlaySidebar}
                  isSidebarCollapsed={isSidebarCollapsed}
                  desktopSidebarRailWidth={desktopSidebarRailWidth}
                  isInteractionDisabled={activeSidebarApp === "capsule" && isContentBusy}
                  capsuleList={capsuleList}
                  activeCapsuleId={activeCapsuleId}
                  onNavigateApp={handleNavigateApp}
                  onCreateCapsule={async () => {
                    await handleCreateCapsuleFromSidebar(isOverlaySidebar ? closeSidebar : undefined);
                  }}
                  onSearchCapsules={() => capsuleSidebarActionsRef.current?.openSearchDialog()}
                  onOpenCapsule={(capsuleId) => {
                    void handleOpenCapsuleFromSidebar(capsuleId, isOverlaySidebar ? closeSidebar : undefined);
                  }}
                  onOpenCapsuleActions={(event, capsule) => {
                    capsuleSidebarActionsRef.current?.openCapsuleActions(event, capsule as CapsuleMeta);
                  }}
                  capsuleHasUnsavedChanges={(capsule) => capsule?.status === "new" || capsule?.status === "modified"}
                  onExpandedAction={isOverlaySidebar ? closeSidebar : undefined}
                  collapsedExpandHitbox={(
                    <Box
                      data-testid="collapsed-sidebar-expand-hitbox"
                      onClick={expandCollapsedSidebar}
                      sx={{ flex: 1, minHeight: 0, cursor: "pointer" }}
                    />
                  )}
                />
              );
            }}
          >
            <Suspense fallback={<RoutePanelFallback />}>
              {renderRightPanel()}
            </Suspense>
          </AppSidebarShell>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: cardPadding,
              pt: hasBrandedPanelHeader ? { xs: 3, md: 3.25 } : undefined,
              backdropFilter: "blur(8px)",
              minHeight: 0,
              height: isSignInView ? { xs: "100%", md: "532px" } : "100%",
              borderRadius: { xs: 0, md: "22px" },
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                height: "100%",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y"
              }}
            >
              <Suspense fallback={<RoutePanelFallback />}>
                {renderRightPanel()}
              </Suspense>
            </Box>
          </Paper>
        )}
      </Container>
      <Snackbar
        open={notificationPrompt.open}
        autoHideDuration={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          "& .MuiSnackbarContent-root": {
            p: 0,
            background: "transparent"
          }
        }}
      >
        <Alert
          severity="info"
          action={(
            <Button
              size="small"
              variant="text"
              onClick={() => { void requestBrowserNotificationPermission(); }}
              sx={{
                color: "primary.main",
                fontWeight: 700,
                "&:hover": {
                  backgroundColor: (theme) => (
                    theme.palette.mode === "dark"
                      ? "rgba(73, 163, 163, 0.14)"
                      : "rgba(28, 124, 124, 0.08)"
                  )
                }
              }}
            >
              {t("notifications.prompt.action")}
            </Button>
          )}
          sx={{
            width: "min(680px, calc(100vw - 32px))",
            alignItems: "center",
            color: "text.primary",
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: (theme) => (
              theme.palette.mode === "dark"
                ? "0 14px 36px rgba(0, 0, 0, 0.34)"
                : "0 14px 32px rgba(31, 41, 51, 0.12)"
            ),
            "& .MuiAlert-icon": {
              color: "#8f6f45"
            },
            "& .MuiAlert-message": {
              py: 1
            }
          }}
        >
          {t("notifications.prompt.message")}
        </Alert>
      </Snackbar>
      <Snackbar
        open={passkeyPrompt.open}
        autoHideDuration={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="info"
          action={(
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="text"
                disabled={passkeyPrompt.loading}
                onClick={() => { void handleAddPasskeyFromPrompt(); }}
                sx={{ color: "primary.main", fontWeight: 700 }}
              >
                {t("passkeys.add")}
              </Button>
              <Button
                size="small"
                variant="text"
                disabled={passkeyPrompt.loading}
                onClick={dismissPasskeyPrompt}
                sx={{ color: "text.secondary", fontWeight: 700 }}
              >
                {t("passkeys.notNow")}
              </Button>
            </Stack>
          )}
          sx={{
            width: "min(680px, calc(100vw - 32px))",
            alignItems: "center",
            color: "text.primary",
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: (theme) => (
              theme.palette.mode === "dark"
                ? "0 14px 36px rgba(0, 0, 0, 0.34)"
                : "0 14px 32px rgba(31, 41, 51, 0.12)"
            )
          }}
        >
          {t("passkeys.prompt")}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(status.error)}
        autoHideDuration={6000}
        onClose={() => {
          setStatus((current) => ({ ...current, error: "" }));
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => {
            setStatus((current) => ({ ...current, error: "" }));
          }}
          sx={{ width: "min(680px, calc(100vw - 32px))" }}
        >
          {status.error}
        </Alert>
      </Snackbar>
      <Dialog
        open={isShareDialogOpen}
        onClose={() => {
          if (!isShareLoading) {
            clearShareRoute();
          }
        }}
        aria-labelledby="share-import-dialog-title"
      >
        <DialogTitle id="share-import-dialog-title">
          {t("capsule.shareImportTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("capsule.shareImportBody", { name: shareMetadata?.name || "" })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isShareLoading} onClick={clearShareRoute}>
            {t("actions.cancel")}
          </Button>
          <Button variant="contained" disabled={isShareLoading} onClick={() => { void handleImportSharedCapsule(); }}>
            {t("capsule.shareImportConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isSignOutConfirmOpen}
        onClose={() => {
          if (!status.loading) {
            setIsSignOutConfirmOpen(false);
          }
        }}
        aria-labelledby="sign-out-dialog-title"
        aria-describedby="sign-out-dialog-description"
      >
        <DialogTitle id="sign-out-dialog-title" sx={{ pb: 1 }}>
          {t("dialogs.signOutTitle")}
        </DialogTitle>
        <DialogContent sx={{ pt: 0.5, pb: 0 }}>
          <DialogContentText id="sign-out-dialog-description" sx={{ color: "text.secondary" }}>
            {t("dialogs.signOutBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
          <Button disabled={status.loading} onClick={() => setIsSignOutConfirmOpen(false)}>
            {t("dialogs.signOutCancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={status.loading}
            onClick={() => { void handleLogout(); }}
          >
            {t("dialogs.signOutConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;
