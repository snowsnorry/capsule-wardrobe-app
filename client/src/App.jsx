import { useEffect, useMemo, useState } from "react";
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
import { useI18n } from "./i18n/useI18n.js";

const initialStatus = {
  loading: false,
  error: "",
  infoKey: "",
  infoParams: null
};

const FALLBACK_STYLE_OPTIONS = [
  "casual",
  "formal",
  "romantic",
  "minimal",
  "sporty",
  "classic",
  "boho",
  "streetwear"
];

const FALLBACK_OCCASION_OPTIONS = [
  "office",
  "city_walk",
  "school_dropoff",
  "party",
  "travel",
  "weekend",
  "date_night",
  "outdoor"
];

const FALLBACK_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

const FALLBACK_AUDIENCE_OPTIONS = ["man", "woman", "any"];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

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
  const [styleOptions, setStyleOptions] = useState([]);
  const [occasionOptions, setOccasionOptions] = useState([]);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [audienceOptions, setAudienceOptions] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedOccasions, setSelectedOccasions] = useState([]);
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [selectedAudience, setSelectedAudience] = useState("");
  const [profileCreated, setProfileCreated] = useState(false);
  const [currentView, setCurrentView] = useState("main");
  const [wardrobeItems, setWardrobeItems] = useState(null);
  const [isLoadingWardrobe, setIsLoadingWardrobe] = useState(false);

  const cardPadding = useMemo(() => (isLarge ? 5 : 3), [isLarge]);

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
    } catch (error) {
      if (useFallback) {
        setStyleOptions(FALLBACK_STYLE_OPTIONS);
        setOccasionOptions(FALLBACK_OCCASION_OPTIONS);
        setSeasonOptions(FALLBACK_SEASON_OPTIONS);
        setAudienceOptions(FALLBACK_AUDIENCE_OPTIONS);
        return;
      }
      throw error;
    }
  };

  const ensureOptionsLoaded = async ({ useFallback = false } = {}) => {
    if (
      styleOptions.length > 0 &&
      occasionOptions.length > 0 &&
      seasonOptions.length > 0 &&
      audienceOptions.length > 0
    ) {
      return;
    }
    await preloadOnboardingOptions({ useFallback });
  };

  const loadProfileSelections = async () => {
    const result = await fetchProfile();
    setSelectedStyles(result.profile?.stylePreferences || []);
    setSelectedOccasions(result.profile?.wardrobeOccasions || []);
    setSelectedSeasons(result.profile?.wardrobeSeasons || []);
    setSelectedAudience(result.profile?.wardrobeAudience || "");
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
        setSelectedStyles([]);
        setSelectedOccasions([]);
        setSelectedSeasons([]);
        setSelectedAudience("");
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
        setSelectedStyles([]);
        setSelectedOccasions([]);
        setSelectedSeasons([]);
        setSelectedAudience("");
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
      setSelectedStyles([]);
      setSelectedOccasions([]);
      setSelectedSeasons([]);
      setSelectedAudience("");
      setOnboardingStep(0);
      setWardrobeItems(null);
      setIsLoadingWardrobe(false);
      clearProfileOptionsCache();
      setStyleOptions([]);
      setOccasionOptions([]);
      setSeasonOptions([]);
      setAudienceOptions([]);
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
    if (onboardingStep === 0 && selectedStyles.length === 0) return;
    if (onboardingStep === 1 && selectedOccasions.length === 0) return;
    if (onboardingStep === 2 && selectedSeasons.length === 0) return;
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
        selectedStyles,
        selectedOccasions,
        selectedSeasons,
        selectedAudience,
        locale
      );
      setProfileCreated(true);
      setHasProfile(true);
      setCurrentView("main");
      setWardrobeItems(null);
      setStatus({ loading: false, error: "", infoKey: "onboarding.completedHint", infoParams: null });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), infoKey: "", infoParams: null });
    }
  };

  const handleSaveProfile = async () => {
    setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
    try {
      await updateProfile(
        selectedStyles,
        selectedOccasions,
        selectedSeasons,
        selectedAudience,
        locale
      );
      setWardrobeItems(null);
      setStatus({ loading: false, error: "", infoKey: "profile.updated", infoParams: null });
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

  const handleOpenProfile = () => {
    ensureOptionsLoaded();
    setCurrentView("profile");
  };

  const handleBackToMain = () => {
    setCurrentView("main");
  };

  const profileKey = JSON.stringify({
    styles: selectedStyles.slice().sort(),
    occasions: selectedOccasions.slice().sort(),
    seasons: selectedSeasons.slice().sort(),
    audience: selectedAudience
  });

  useEffect(() => {
    if (!user || !(hasProfile || profileCreated)) {
      return;
    }
    if (wardrobeItems) {
      return;
    }

    let isActive = true;
    setIsLoadingWardrobe(true);
    import("./api/wardrobe.js").then(async ({ fetchWardrobeItems }) => {
      try {
        const result = await fetchWardrobeItems();
        if (!isActive) return;
        setWardrobeItems(result.items || []);
      } catch (error) {
        if (!isActive) return;
        setWardrobeItems([]);
      } finally {
        if (!isActive) return;
        setIsLoadingWardrobe(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [user, hasProfile, profileCreated, wardrobeItems]);

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
      if (currentView === "profile") {
        return (
          <ProfileScreen
            styleOptions={styleOptions}
            occasionOptions={occasionOptions}
            seasonOptions={seasonOptions}
            audienceOptions={audienceOptions}
            selectedStyles={selectedStyles}
            selectedOccasions={selectedOccasions}
            selectedSeasons={selectedSeasons}
            selectedAudience={selectedAudience}
            status={status}
            onToggleStyle={(value) => toggleSelection(value, selectedStyles, setSelectedStyles)}
            onToggleOccasion={(value) =>
              toggleSelection(value, selectedOccasions, setSelectedOccasions)
            }
            onToggleSeason={(value) => toggleSelection(value, selectedSeasons, setSelectedSeasons)}
            onSelectAudience={setSelectedAudience}
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
          onOpenProfile={handleOpenProfile}
          profileKey={profileKey}
          items={wardrobeItems || []}
          isLoadingItems={isLoadingWardrobe}
        />
      );
    }

    return (
      <OnboardingScreen
        onboardingStep={onboardingStep}
        styleOptions={styleOptions}
        occasionOptions={occasionOptions}
        seasonOptions={seasonOptions}
        audienceOptions={audienceOptions}
        selectedStyles={selectedStyles}
        selectedOccasions={selectedOccasions}
        selectedSeasons={selectedSeasons}
        selectedAudience={selectedAudience}
        status={status}
        onToggleStyle={(value) => toggleSelection(value, selectedStyles, setSelectedStyles)}
        onToggleOccasion={(value) =>
          toggleSelection(value, selectedOccasions, setSelectedOccasions)
        }
        onToggleSeason={(value) => toggleSelection(value, selectedSeasons, setSelectedSeasons)}
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
        maxWidth="lg"
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: { xs: 3, md: 6 },
          gridTemplateColumns: user ? "1fr" : { xs: "1fr", md: "1.2fr 1fr" },
          alignItems: "center",
          py: { xs: 0, md: 10 },
          px: { xs: 0, md: 3 },
          minHeight: "100vh",
          height: "100%",
          boxSizing: "border-box"
        }}
      >
        {!sessionInitialized ? null : !user ? (
          <Stack spacing={3} sx={{ pr: { md: 4 } }}>
            <Box
              sx={{
                display: { xs: "none", md: "block" },
                width: { md: "92%", lg: "100%" },
                maxWidth: { md: 340, lg: 420 },
                ml: { md: -1, lg: -2 },
                mb: { md: -1, lg: -1.5 },
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
              variant="overline"
              sx={{ letterSpacing: 2, color: "#8f6f45", opacity: 0.96 }}
            >
              {t("appName")}
            </Typography>
            <Typography
              variant={isLarge ? "h2" : "h3"}
              sx={{ fontSize: { xs: "1.85rem", sm: "2.1rem", md: "2.6rem" } }}
            >
              {t("marketingHeadline")}
            </Typography>
          </Stack>
        ) : null}

        <Paper
          elevation={0}
          sx={{
            p: cardPadding,
            backdropFilter: "blur(8px)",
            minHeight: 0,
            height: "100%",
            borderRadius: { xs: 0, md: 4 },
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
