import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  fetchCurrentUser,
  fetchProfileStatus,
  updateProfileLocale,
  deleteProfile,
  initializeProfile,
  logout,
  requestLoginCode,
  verifyLoginCode,
  signInWithGoogle
} from "./api/auth.js";
import {
  createCapsule,
  deleteCapsule,
  downloadCapsulePdf,
  duplicateCapsule,
  fetchCapsule,
  fetchCapsuleBootstrap,
  fetchRecentCapsules,
  renameCapsule,
  revertCapsule,
  saveCapsule,
  searchCapsules,
  updateCapsuleFilters
} from "./api/capsules.js";
import { clearProfileOptionsCache, loadProfileOptions } from "./api/profileOptionsCache.js";
import { clearRequestCache } from "./api/auth.js";
import {
  regenerateCapsuleWardrobe as requestWardrobeRegeneration,
  regenerateSelectedWardrobeItems as requestSelectedWardrobeRegeneration,
  subscribeCapsuleEvents
} from "./api/wardrobe.js";
import MainScreen from "./screens/MainScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import SignInScreen from "./screens/SignInScreen.jsx";
import SearchScreen from "./screens/SearchScreen.jsx";
import { useI18n } from "./i18n/useI18n.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";
import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";

const initialStatus = {
  loading: false,
  error: "",
  infoKey: "",
  infoParams: null
};

const FALLBACK_STYLE_OPTIONS = {
  core: ["casual", "smart_casual", "formal"],
  aesthetics: ["minimalistic", "street_style", "romantic", "preppy", "retro", "boho", "nautical", "safari", "equestrian", "military", "grunge", "sporty"]
};

const FALLBACK_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "school_drop-off",
  "weekend_with_family"
];

const FALLBACK_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

const FALLBACK_AUDIENCE_OPTIONS = ["man", "woman", "any"];
const FALLBACK_ACCENT_COLOR_OPTIONS = ACCENT_COLOR_OPTIONS;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];
function getAppRoute(pathname = "/") {
  return pathname === "/search" || pathname === "/search/" ? "search" : "capsule";
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

function normalizeWardrobeItemUrl(item) {
  return String(item?.url || "").trim();
}

function buildDisplayWardrobeItems(items) {
  return sortWardrobeItems(Array.isArray(items) ? items : []);
}

function mergeWardrobeItemsIntoExistingOrder({
  currentItems = [],
  nextItems = [],
  pendingUrls = []
} = {}) {
  const orderedCurrentItems = Array.isArray(currentItems) ? currentItems : [];
  const orderedNextItems = buildDisplayWardrobeItems(nextItems);
  const normalizedPendingUrls = Array.isArray(pendingUrls)
    ? pendingUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
    : [];

  if (orderedCurrentItems.length === 0 || normalizedPendingUrls.length === 0) {
    return orderedNextItems;
  }

  const pendingUrlSet = new Set(normalizedPendingUrls);
  const nextItemsByUrl = new Map(
    orderedNextItems
      .map((item) => [normalizeWardrobeItemUrl(item), item])
      .filter(([itemUrl]) => itemUrl)
  );
  const preservedItemUrls = new Set(
    orderedCurrentItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter((itemUrl) => itemUrl && !pendingUrlSet.has(itemUrl))
  );
  const replacementCandidates = orderedNextItems.filter((item) => !preservedItemUrls.has(normalizeWardrobeItemUrl(item)));
  const consumedReplacementIndexes = new Set();

  const takeReplacementItem = (category) => {
    const preferredCategory = String(category || "");
    let replacementIndex = replacementCandidates.findIndex((item, index) => (
      !consumedReplacementIndexes.has(index) && String(item?.category || "") === preferredCategory
    ));
    if (replacementIndex === -1) {
      replacementIndex = replacementCandidates.findIndex((_, index) => !consumedReplacementIndexes.has(index));
    }
    if (replacementIndex === -1) {
      return null;
    }

    consumedReplacementIndexes.add(replacementIndex);
    return replacementCandidates[replacementIndex];
  };

  const mergedItems = orderedCurrentItems.map((currentItem) => {
    const currentItemUrl = normalizeWardrobeItemUrl(currentItem);
    if (!pendingUrlSet.has(currentItemUrl)) {
      return nextItemsByUrl.get(currentItemUrl) || currentItem;
    }

    return takeReplacementItem(currentItem?.category) || currentItem;
  });

  const mergedItemUrls = new Set(
    mergedItems
      .map((item) => normalizeWardrobeItemUrl(item))
      .filter(Boolean)
  );
  const appendedItems = orderedNextItems.filter((item) => !mergedItemUrls.has(normalizeWardrobeItemUrl(item)));

  return [...mergedItems, ...appendedItems];
}

function buildCapsuleStatus(capsule) {
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

function buildEmptyCapsuleDraft(locale = "en") {
  return {
    filters: {
      formalityLevel: "",
      style: null,
      occasions: [],
      season: [],
      audience: "",
      color: null,
      pattern: null,
      locale
    },
    data: {
      wardrobe: null,
      rejectedUrls: []
    }
  };
}

function getEffectiveCapsule(capsule) {
  return capsule?.draft || capsule?.saved || null;
}

function hasStoredWardrobeItems(capsule) {
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
  const theme = useTheme();
  const isLarge = useMediaQuery(theme.breakpoints.up("md"));
  const { t, locale, setLocale } = useI18n();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [styleOptions, setStyleOptions] = useState(FALLBACK_STYLE_OPTIONS);
  const [occasionOptions, setOccasionOptions] = useState([]);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [audienceOptions, setAudienceOptions] = useState([]);
  const [patternOptions, setPatternOptions] = useState([]);
  const [selectedFormalityLevel, setSelectedFormalityLevel] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedOccasions, setSelectedOccasions] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState([]);
  const [selectedAudience, setSelectedAudience] = useState("");
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [profileCreated, setProfileCreated] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [profileItems, setProfileItems] = useState(null);
  const [activeCapsuleId, setActiveCapsuleId] = useState("");
  const [activeCapsuleMeta, setActiveCapsuleMeta] = useState(null);
  const [capsuleList, setCapsuleList] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isContentOperationLoading, setIsContentOperationLoading] = useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] = useState(false);
  const [selectedRegenerationUrls, setSelectedRegenerationUrls] = useState([]);
  const [partialRegenerationPendingUrls, setPartialRegenerationPendingUrls] = useState([]);
  const [isPartialRegenerationLoading, setIsPartialRegenerationLoading] = useState(false);
  const [isWardrobePending, setIsWardrobePending] = useState(false);
  const [hasPendingAdditionalItems, setHasPendingAdditionalItems] = useState(false);
  const [wardrobeLoadedCapsuleId, setWardrobeLoadedCapsuleId] = useState("");
  const [persistedProfileLocale, setPersistedProfileLocale] = useState("");
  const [appRoute, setAppRoute] = useState(() => (
    typeof window === "undefined" ? "capsule" : getAppRoute(window.location.pathname)
  ));
  const isMountedRef = useRef(true);
  const pendingRegenerationUrlsRef = useRef([]);
  const regenerationBaseItemsRef = useRef([]);
  const capsuleEventsAbortRef = useRef(null);
  const manualWardrobeRegenerationCapsuleIdRef = useRef("");

  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);
  const orderedSeasonOptions = useMemo(() => sortSeasonOptions(seasonOptions), [seasonOptions]);

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
      setAppRoute(getAppRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const resolveErrorMessage = (error) => {
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
    return t("errors.generic");
  };

  useEffect(() => {
    let isActive = true;
    const bootstrapSession = async () => {
      setIsCheckingSession(true);
      try {
        const current = await fetchCurrentUser();
        if (!isActive) return;
        setUser(current.user);
        const profileStatus = await fetchProfileStatus();
        if (!isActive) return;
        setHasProfile(profileStatus.hasProfile);
        setProfileCreated(profileStatus.hasProfile);
        if (!profileStatus.hasProfile) {
          await preloadOnboardingOptions();
          if (!isActive) return;
        } else {
          await Promise.all([ensureOptionsLoaded(), bootstrapCapsules()]);
          if (!isActive) return;
        }
      } catch (error) {
        if (!isActive) return;
        setUser(null);
        setHasProfile(false);
        setPersistedProfileLocale("");
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

  const preloadOnboardingOptions = async ({ useFallback = false } = {}) => {
    try {
      const result = await loadProfileOptions();
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

  const ensureOptionsLoaded = async ({ useFallback = false } = {}) => {
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

  const applyCapsuleState = (capsule, { capsules = null } = {}) => {
    if (!capsule) {
      return;
    }

    const effective = getEffectiveCapsule(capsule) || buildEmptyCapsuleDraft(locale);
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
    setSelectedPattern(effective.filters?.pattern ?? null);
    setProfileItems(buildDisplayWardrobeItems(effective.data?.wardrobe?.items || []));
    setWardrobeLoadedCapsuleId(hasStoredWardrobeItems(capsule) ? capsule.id || "" : "");
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    manualWardrobeRegenerationCapsuleIdRef.current = "";
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);

    if (Array.isArray(capsules)) {
      setCapsuleList(capsules);
    }
  };

  const buildCurrentDraftSnapshot = ({ wardrobe = profileItems, rejectedUrls = null } = {}) => ({
    filters: {
      formalityLevel: selectedFormalityLevel,
      style: selectedStyle,
      occasions: selectedOccasions,
      season: selectedSeason,
      audience: selectedAudience,
      color: selectedColor,
      pattern: selectedPattern,
      locale
    },
    data: {
      wardrobe: wardrobe
        ? {
          items: Array.isArray(wardrobe) ? wardrobe : wardrobe.items || [],
          reasoning: wardrobe?.reasoning || null,
          rawSelectionText: wardrobe?.rawSelectionText || null,
          swimwearReasoning: wardrobe?.swimwearReasoning || null,
          swimwearRawSelectionText: wardrobe?.swimwearRawSelectionText || null
        }
        : null,
      rejectedUrls: Array.isArray(rejectedUrls)
        ? rejectedUrls
        : getEffectiveCapsule(activeCapsuleMeta)?.data?.rejectedUrls || []
    }
  });

  const bootstrapCapsules = async () => {
    const result = await fetchCapsuleBootstrap();
    if (result.profile?.locale) {
      setPersistedProfileLocale(result.profile.locale);
      setLocale(result.profile.locale);
    }
    applyCapsuleState(result.activeCapsule, { capsules: result.capsules || [] });
  };

  const handleRequestCode = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await requestLoginCode(email.trim(), locale);
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

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await verifyLoginCode(email.trim(), code.trim());
      const profileStatus = await retry(() => fetchProfileStatus());
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions({ useFallback: true });
        setUser(result.user);
        setSelectedFormalityLevel("");
        setSelectedStyle(null);
        setSelectedOccasions([]);
        setSelectedSeason([]);
        setSelectedAudience("");
        setSelectedColor(null);
        setSelectedPattern(null);
        setOnboardingStep(0);
        setStatus({ loading: false, error: "", infoKey: "", infoParams: null });
      } else {
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), bootstrapCapsules()]);
        setUser(result.user);
        setStatus({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
      }
    } catch (error) {
      setUser(null);
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
      setCode("");
    }
  };

  const handleGoogleCredential = async (idToken) => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await signInWithGoogle(idToken);
      const profileStatus = await retry(() => fetchProfileStatus());
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions({ useFallback: true });
        setUser(result.user);
        setSelectedFormalityLevel("");
        setSelectedStyle(null);
        setSelectedOccasions([]);
        setSelectedSeason([]);
        setSelectedAudience("");
        setSelectedColor(null);
        setSelectedPattern(null);
        setOnboardingStep(0);
        setStatus({ loading: false, error: "", infoKey: "", infoParams: null });
      } else {
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), bootstrapCapsules()]);
        setUser(result.user);
        setStatus({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
      }
    } catch (error) {
      setUser(null);
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleLogout = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await logout();
      clearRequestCache();
      setUser(null);
      setHasProfile(false);
      setProfileCreated(false);
      setPersistedProfileLocale("");
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
      setSelectedPattern(null);
      setOnboardingStep(0);
      setProfileItems(null);
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
      await createCapsule({
        filters: buildCurrentDraftSnapshot({ wardrobe: null, rejectedUrls: [] }).filters
      });
      setProfileCreated(true);
      setHasProfile(true);
      setCurrentView("main");
      setProfileItems(null);
      setSelectedRegenerationUrls([]);
      setPartialRegenerationPendingUrls([]);
      setIsPartialRegenerationLoading(false);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      await bootstrapCapsules();
      setStatus({ loading: false, error: "", infoKey: "onboarding.completedHint", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleSaveProfile = async () => {
    await handleApplyCapsuleFilters();
  };

  const refreshCapsuleList = async () => {
    const result = await fetchRecentCapsules();
    setCapsuleList(result.capsules || []);
  };

  const handleApplyCapsuleFilters = async () => {
    if (!activeCapsuleId) {
      return;
    }

    setIsContentOperationLoading(true);
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      const result = await updateCapsuleFilters(activeCapsuleId, buildCurrentDraftSnapshot().filters);
      setActiveCapsuleMeta(result.capsule);
      setProfileItems([]);
      setWardrobeLoadedCapsuleId("");
      manualWardrobeRegenerationCapsuleIdRef.current = activeCapsuleId;
      await refreshCapsuleList();
      setIsLoadingItems(true);
      const response = await requestWardrobeRegeneration({ capsuleId: activeCapsuleId });
      if (response?.status === "pending") {
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
      const result = await createCapsule({ filters: buildEmptyCapsuleDraft(locale).filters });
      applyCapsuleState(result.capsule);
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleOpenCapsule = async (capsuleId) => {
    setIsContentOperationLoading(true);
    try {
      const result = await fetchCapsule(capsuleId);
      applyCapsuleState(result.capsule);
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleSaveCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    const result = await saveCapsule(capsuleId);
    if (capsuleId === activeCapsuleId) {
      setActiveCapsuleMeta(result.capsule);
    }
    await refreshCapsuleList();
  };

  const handleRevertCapsule = async (capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await revertCapsule(capsuleId);
      if (capsuleId === activeCapsuleId) {
        applyCapsuleState(result.capsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleRenameCapsule = async (name, capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    const result = await renameCapsule(capsuleId, name);
    if (capsuleId === activeCapsuleId) {
      setActiveCapsuleMeta(result.capsule);
    }
    await refreshCapsuleList();
  };

  const handleDuplicateCapsule = async (name, capsuleId = activeCapsuleId) => {
    if (!capsuleId) {
      return;
    }
    setIsContentOperationLoading(true);
    try {
      const result = await duplicateCapsule(capsuleId, name);
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
      const result = await deleteCapsule(capsuleId);
      if (result.activeCapsule) {
        applyCapsuleState(result.activeCapsule);
      }
      await refreshCapsuleList();
    } finally {
      setIsContentOperationLoading(false);
    }
  };

  const handleSearchCapsules = async (query) => {
    const result = await searchCapsules(query);
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

  const handleNavigateApp = (nextApp) => {
    if (typeof window === "undefined") {
      return;
    }
    const nextPath = nextApp === "search" ? "/search" : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setAppRoute(getAppRoute(nextPath));
  };

  const isSignInView = !user;
  const isSearchView = Boolean(user && (hasProfile || profileCreated) && appRoute === "search");
  const isMainScreenView = Boolean(user && (hasProfile || profileCreated) && currentView === "main" && appRoute !== "search");
  const isOnboardingView = Boolean(user && !hasProfile && !profileCreated);
  const hasBrandedPanelHeader = isSignInView || isMainScreenView || isOnboardingView || isSearchView;
  const canGenerateWardrobe = Boolean(
    selectedFormalityLevel &&
    selectedOccasions.length > 0 &&
    selectedSeason.length > 0 &&
    selectedAudience
  );
  const isContentBusy = isLoadingItems || isWardrobePending || isPartialRegenerationLoading || isContentOperationLoading;

  const logWardrobeReasoning = (reasoning) => {
    if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
      return;
    }

    console.log("[wardrobe-ai][reasoning]", reasoning);
  };

  const handleWardrobeError = () => {
    setProfileItems([]);
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

  const applyWardrobeSnapshot = async (snapshot) => {
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const pendingRegenerationUrls = Array.isArray(snapshot?.pendingRegenerationUrls)
      ? snapshot.pendingRegenerationUrls.map((itemUrl) => String(itemUrl || "").trim()).filter(Boolean)
      : [];
    const isPending = snapshot?.status === "pending";
    const isPendingExtras = Boolean(snapshot?.hasPendingAdditionalItems);

    if (snapshot?.status === "failed") {
      manualWardrobeRegenerationCapsuleIdRef.current = "";
      stopCapsuleEventStream();
      handleWardrobeError();
      setStatus((current) => ({
        ...current,
        error: t("errors.generic")
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
          })
          : buildDisplayWardrobeItems(items)
      ));
      setSelectedRegenerationUrls([]);
      pendingRegenerationUrlsRef.current = pendingRegenerationUrls;
      setPartialRegenerationPendingUrls(pendingRegenerationUrls);
      setIsPartialRegenerationLoading(pendingRegenerationUrls.length > 0);
      setIsWardrobePending(true);
      setHasPendingAdditionalItems(isPendingExtras);
      setIsLoadingItems(items.length === 0 && !isPendingExtras);
      return;
    }

    logWardrobeReasoning(snapshot?.reasoning);
    const currentPendingUrls = pendingRegenerationUrlsRef.current;
    const baseItems = currentPendingUrls.length > 0 ? regenerationBaseItemsRef.current : [];
    setProfileItems((currentItems) => (
      currentPendingUrls.length > 0
        ? mergeWardrobeItemsIntoExistingOrder({
          currentItems: baseItems.length > 0 ? baseItems : currentItems,
          nextItems: items,
          pendingUrls: currentPendingUrls
        })
        : buildDisplayWardrobeItems(items)
    ));
    setSelectedRegenerationUrls([]);
    pendingRegenerationUrlsRef.current = [];
    regenerationBaseItemsRef.current = [];
    setPartialRegenerationPendingUrls([]);
    setIsPartialRegenerationLoading(false);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setIsLoadingItems(false);
    setWardrobeLoadedCapsuleId(snapshot?.status === "ready" ? activeCapsuleId : "");

    if (snapshot?.status !== "pending") {
      manualWardrobeRegenerationCapsuleIdRef.current = "";
      stopCapsuleEventStream();
    }

    if (snapshot?.status === "ready") {
      try {
        const capsuleResult = await fetchCapsule(activeCapsuleId);
        setActiveCapsuleMeta(capsuleResult.capsule);
        await refreshCapsuleList();
      } catch {
        // Keep rendered items even if sidebar metadata refresh fails.
      }
    }
  };

  const startCapsuleEventStream = (capsuleId) => {
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

        applyWardrobeSnapshot(event.data).catch(() => {
          if (!isMountedRef.current) {
            return;
          }
          stopCapsuleEventStream();
          handleWardrobeError();
        });
      },
      onError(error) {
        if (!isMountedRef.current) {
          return;
        }
        stopCapsuleEventStream();
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
      const response = await requestWardrobeRegeneration({ capsuleId: activeCapsuleId });
      if (response?.status === "pending") {
        startCapsuleEventStream(activeCapsuleId);
      } else {
        setIsLoadingItems(false);
      }
    } catch (error) {
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

  const handleToggleRegenerationSelection = (item) => {
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
      const response = await requestSelectedWardrobeRegeneration({ itemUrls: pendingUrls, capsuleId: activeCapsuleId });
      if (response?.status === "pending") {
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
      setStatus((current) => ({
        ...current,
        error: error?.message === "invalid_payload"
          ? resolveErrorMessage(error)
          : t("errors.regenerateSelectedFailed")
      }));
    }
  };

  useEffect(() => {
    pendingRegenerationUrlsRef.current = partialRegenerationPendingUrls;
  }, [partialRegenerationPendingUrls]);

  useEffect(() => {
    stopCapsuleEventStream();
  }, [activeCapsuleId]);

  useEffect(() => {
    if (!user || !(hasProfile || profileCreated) || !activeCapsuleId || !canGenerateWardrobe) {
      return;
    }
    if (wardrobeLoadedCapsuleId === activeCapsuleId || isWardrobePending || hasStoredWardrobeItems(activeCapsuleMeta)) {
      return;
    }
    if (manualWardrobeRegenerationCapsuleIdRef.current === activeCapsuleId) {
      return;
    }

    setIsLoadingItems(true);
    requestWardrobeRegeneration({ capsuleId: activeCapsuleId })
      .then((response) => {
        if (!isMountedRef.current) {
          return;
        }
        if (response?.status === "pending") {
          startCapsuleEventStream(activeCapsuleId);
          return;
        }
        setIsLoadingItems(false);
      })
      .catch((error) => {
        if (!isMountedRef.current) {
          return;
        }
        handleWardrobeError();
        setStatus((current) => ({
          ...current,
          error: resolveErrorMessage(error)
        }));
      });
  }, [user, hasProfile, profileCreated, activeCapsuleId, canGenerateWardrobe, wardrobeLoadedCapsuleId, isWardrobePending, activeCapsuleMeta]);

  useEffect(() => () => {
    stopCapsuleEventStream();
  }, []);

  useEffect(() => {
    if (!sessionInitialized || !user || !(hasProfile || profileCreated)) {
      return;
    }
    if (!persistedProfileLocale || locale === persistedProfileLocale) {
      return;
    }
    updateProfileLocale(locale)
      .then(() => {
        if (isMountedRef.current) {
          setPersistedProfileLocale(locale);
        }
      })
      .catch(() => {});
  }, [locale, persistedProfileLocale, sessionInitialized, user, hasProfile, profileCreated]);

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
          onResetEmail={resetToEmail}
        />
      );
    }

    if (hasProfile || profileCreated) {
      if (appRoute === "search") {
        return <SearchScreen onNavigateApp={handleNavigateApp} />;
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
          onSignOut={handleLogout}
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
          onSearchCapsules={handleSearchCapsules}
          items={profileItems || []}
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
          onApplyFilters={handleApplyCapsuleFilters}
          onResetFilters={handleResetProfileFilters}
          onNavigateApp={handleNavigateApp}
          selectedRegenerationUrls={selectedRegenerationUrls}
          partialRegenerationPendingUrls={partialRegenerationPendingUrls}
          onToggleRegenerationSelection={handleToggleRegenerationSelection}
          onCancelRegenerationSelection={handleCancelRegenerationSelection}
          onRegenerateSelectedItems={handleRegenerateSelectedItems}
          isPartialRegenerationLoading={isPartialRegenerationLoading}
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
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "#fcfbf9",
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
        position: "relative",
        overflow: "hidden",
        "&::before": { display: "none" },
        "&::after": { display: "none" }
      }}
    >
      <Container
        disableGutters={isMainScreenView}
        maxWidth={isMainScreenView || isSearchView ? false : "lg"}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: user ? "1fr" : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          py: isMainScreenView ? { xs: 0, md: "12px" } : { xs: 0, md: "24px" },
          px: isMainScreenView ? 0 : (isSearchView ? { xs: 0, md: 4, xl: 5 } : { xs: 0, md: 3 }),
          maxWidth: isMainScreenView ? "none" : (isSearchView ? "1680px" : undefined),
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
                  fetchpriority="high"
                  decoding="async"
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

        {!sessionInitialized ? null : isMainScreenView ? (
          <Box
            sx={{
              minHeight: 0,
              height: "100%",
              overflow: "hidden"
            }}
          >
            {renderRightPanel()}
          </Box>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: cardPadding,
              pt: hasBrandedPanelHeader ? { xs: 3, md: 3.25 } : undefined,
              backdropFilter: "blur(8px)",
              minHeight: 0,
              height: isSignInView ? { xs: "100%", md: "517px" } : "100%",
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
              {renderRightPanel()}
            </Box>
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default App;
