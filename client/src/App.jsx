import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  fetchCurrentUser,
  fetchProfile,
  fetchProfileStatus,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  initializeProfile,
  logout,
  requestLoginCode,
  verifyLoginCode,
  signInWithGoogle
} from "./api/auth.js";
import { clearProfileOptionsCache, loadProfileOptions } from "./api/profileOptionsCache.js";
import { clearRequestCache } from "./api/auth.js";
import LoadingScreen from "./screens/LoadingScreen.jsx";
import MainScreen from "./screens/MainScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import SignInScreen from "./screens/SignInScreen.jsx";
import SearchScreen from "./screens/SearchScreen.jsx";
import { useI18n } from "./i18n/useI18n.js";
import { ACCENT_COLOR_OPTIONS } from "../../shared/accentColors.js";

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
const WARDROBE_POLL_AFTER_MS_DEFAULT = 2000;

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
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isDownloadingWardrobePdf, setIsDownloadingWardrobePdf] = useState(false);
  const [isWardrobePending, setIsWardrobePending] = useState(false);
  const [hasPendingAdditionalItems, setHasPendingAdditionalItems] = useState(false);
  const [wardrobePollAfterMs, setWardrobePollAfterMs] = useState(WARDROBE_POLL_AFTER_MS_DEFAULT);
  const [appRoute, setAppRoute] = useState(() => (
    typeof window === "undefined" ? "capsule" : getAppRoute(window.location.pathname)
  ));
  const isMountedRef = useRef(true);
  const wardrobeRequestIdRef = useRef(0);

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
          await Promise.all([ensureOptionsLoaded(), loadProfileSelections()]);
          if (!isActive) return;
        }
      } catch (error) {
        if (!isActive) return;
        setUser(null);
        setHasProfile(false);
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

  const loadProfileSelections = async () => {
    const result = await fetchProfile();
    setSelectedFormalityLevel(result.profile?.formalityLevel || "");
    setSelectedStyle(result.profile?.style ?? null);
    setSelectedOccasions(result.profile?.occasions || []);
    setSelectedSeason(result.profile?.season || []);
    setSelectedAudience(result.profile?.audience || "");
    setSelectedColor(result.profile?.color ?? null);
    setSelectedPattern(result.profile?.pattern ?? null);
    if (result.profile?.locale) {
      setLocale(result.profile.locale);
    }
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
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), loadProfileSelections()]);
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
        await Promise.all([ensureOptionsLoaded({ useFallback: true }), loadProfileSelections()]);
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
      setIsLoadingItems(false);
      setIsDownloadingWardrobePdf(false);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      setWardrobePollAfterMs(WARDROBE_POLL_AFTER_MS_DEFAULT);
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
      await initializeProfile(
        selectedFormalityLevel,
        selectedStyle,
        selectedOccasions,
        selectedSeason,
        selectedAudience,
        locale
      );
      setProfileCreated(true);
      setHasProfile(true);
      setCurrentView("main");
      setProfileItems(null);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      setStatus({ loading: false, error: "", infoKey: "onboarding.completedHint", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleSaveProfile = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await updateProfile(
        selectedFormalityLevel,
        selectedStyle,
        selectedOccasions,
        selectedSeason,
        selectedAudience,
        selectedColor,
        selectedPattern,
        locale
      );
      setProfileItems(null);
      setIsWardrobePending(false);
      setHasPendingAdditionalItems(false);
      setStatus({ loading: false, error: "", infoKey: "profile.updated", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleResetProfileFilters = async () => {
    setStatus(initialStatus);
    try {
      await ensureOptionsLoaded({ useFallback: true });
      await loadProfileSelections();
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
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

  const profileKey = JSON.stringify({
    formalityLevel: selectedFormalityLevel,
    style: selectedStyle,
    occasions: selectedOccasions.slice().sort(),
    season: selectedSeason.slice().sort(),
    audience: selectedAudience,
    color: selectedColor,
    pattern: selectedPattern
  });
  const isSignInView = !user;
  const isSearchView = Boolean(user && (hasProfile || profileCreated) && appRoute === "search");
  const isMainScreenView = Boolean(user && (hasProfile || profileCreated) && currentView === "main" && appRoute !== "search");
  const isOnboardingView = Boolean(user && !hasProfile && !profileCreated);
  const hasBrandedPanelHeader = isSignInView || isMainScreenView || isOnboardingView || isSearchView;

  const loadWardrobeItems = async ({ force = false } = {}) => {
    const { fetchWardrobeItems } = await import("./api/wardrobe.js");
    return fetchWardrobeItems({ profileKey, force });
  };

  const logWardrobeReasoning = (reasoning) => {
    if (typeof reasoning !== "string" || reasoning.trim().length === 0) {
      return;
    }

    console.log("[wardrobe-ai][reasoning]", reasoning);
  };

  const handleWardrobeError = () => {
    setProfileItems([]);
    setIsWardrobePending(false);
    setHasPendingAdditionalItems(false);
    setWardrobePollAfterMs(WARDROBE_POLL_AFTER_MS_DEFAULT);
    setIsLoadingItems(false);
  };

  const runWardrobeLoad = async ({ force = false } = {}) => {
    const requestId = wardrobeRequestIdRef.current + 1;
    wardrobeRequestIdRef.current = requestId;
    setIsLoadingItems(true);

    let nextForce = force;

    while (true) {
      try {
        const result = await loadWardrobeItems({ force: nextForce });
        if (!isMountedRef.current || requestId !== wardrobeRequestIdRef.current) {
          return;
        }

        const items = Array.isArray(result?.items) ? result.items : [];
        if (result?.status === "pending") {
          const nextPollAfterMs =
            Number(result?.pollAfterMs) > 0 ? Number(result.pollAfterMs) : WARDROBE_POLL_AFTER_MS_DEFAULT;
          const isPendingExtras = Boolean(result?.hasPendingAdditionalItems);
          setProfileItems(items);
          setIsWardrobePending(true);
          setHasPendingAdditionalItems(isPendingExtras);
          setWardrobePollAfterMs(nextPollAfterMs);
          setIsLoadingItems(items.length === 0 && !isPendingExtras);

          await new Promise((resolve) => setTimeout(resolve, nextPollAfterMs));
          if (!isMountedRef.current || requestId !== wardrobeRequestIdRef.current) {
            return;
          }

          nextForce = false;
          continue;
        }

        logWardrobeReasoning(result?.reasoning);
        setProfileItems(items);
        setIsWardrobePending(false);
        setHasPendingAdditionalItems(false);
        setWardrobePollAfterMs(WARDROBE_POLL_AFTER_MS_DEFAULT);
        setIsLoadingItems(false);
        return;
      } catch (error) {
        if (!isMountedRef.current || requestId !== wardrobeRequestIdRef.current) {
          return;
        }
        handleWardrobeError();
        return;
      }
    }
  };

  const handleRefreshWardrobe = async () => {
    await runWardrobeLoad({ force: true });
  };

  const handleDownloadWardrobePdf = async () => {
    setIsDownloadingWardrobePdf(true);
    try {
      const { downloadWardrobePdf } = await import("./api/wardrobe.js");
      await downloadWardrobePdf({ locale });
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

  useEffect(() => {
    if (!user || !(hasProfile || profileCreated)) {
      return;
    }
    if (profileItems || isWardrobePending) {
      return;
    }

    runWardrobeLoad();
  }, [user, hasProfile, profileCreated, profileItems, isWardrobePending]);

  useEffect(() => {
    if (!sessionInitialized || !user || !(hasProfile || profileCreated)) {
      return;
    }
    updateProfileLocale(locale).catch(() => {});
  }, [locale, sessionInitialized, user, hasProfile, profileCreated]);

  const renderRightPanel = () => {
    if (isCheckingSession || !sessionInitialized) {
      return <LoadingScreen />;
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
          onSignOut={handleLogout}
          isSigningOut={status.loading}
          onRefreshItems={handleRefreshWardrobe}
          onDownloadPdf={handleDownloadWardrobePdf}
          items={profileItems || []}
          isLoadingItems={isLoadingItems}
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
          onApplyFilters={handleSaveProfile}
          onResetFilters={handleResetProfileFilters}
          onNavigateApp={handleNavigateApp}
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
        maxWidth={isMainScreenView || isSearchView ? false : "lg"}
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: user ? "1fr" : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          py: { xs: 0, md: "24px" },
          px: isMainScreenView || isSearchView ? { xs: 0, md: 4, xl: 5 } : { xs: 0, md: 3 },
          maxWidth: isMainScreenView || isSearchView ? "1680px" : undefined,
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
              <Box
                component="img"
                src="/girl.png"
                alt=""
                aria-hidden="true"
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
      </Container>
    </Box>
  );
}

export default App;
