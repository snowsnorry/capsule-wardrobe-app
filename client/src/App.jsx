import { useEffect, useMemo, useState } from "react";
import { Box, Container, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  fetchCurrentUser,
  fetchProfile,
  fetchProfileStatus,
  updateProfile,
  deleteProfile,
  initializeProfile,
  logout,
  requestLoginCode,
  verifyLoginCode
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
  info: ""
};

function App() {
  const theme = useTheme();
  const isLarge = useMediaQuery(theme.breakpoints.up("md"));
  const { t } = useI18n();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [styleOptions, setStyleOptions] = useState([]);
  const [occasionOptions, setOccasionOptions] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedOccasions, setSelectedOccasions] = useState([]);
  const [profileCreated, setProfileCreated] = useState(false);
  const [currentView, setCurrentView] = useState("main");

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
    return t("errors.generic");
  };

  useEffect(() => {
    const bootstrapSession = async () => {
      setIsCheckingSession(true);
      try {
        const current = await fetchCurrentUser();
        setUser(current.user);
        const profileStatus = await fetchProfileStatus();
        setHasProfile(profileStatus.hasProfile);
        setProfileCreated(profileStatus.hasProfile);
        if (!profileStatus.hasProfile) {
          await preloadOnboardingOptions();
        } else {
          await Promise.all([ensureOptionsLoaded(), loadProfileSelections()]);
        }
      } catch (error) {
        setUser(null);
        setHasProfile(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    bootstrapSession();
  }, []);

  const preloadOnboardingOptions = async () => {
    const result = await loadProfileOptions();
    setStyleOptions(result.styles);
    setOccasionOptions(result.occasions);
  };

  const ensureOptionsLoaded = async () => {
    if (styleOptions.length > 0 && occasionOptions.length > 0) {
      return;
    }
    await preloadOnboardingOptions();
  };

  const loadProfileSelections = async () => {
    const result = await fetchProfile();
    setSelectedStyles(result.profile?.stylePreferences || []);
    setSelectedOccasions(result.profile?.wardrobeOccasions || []);
  };

  const handleRequestCode = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", info: "" });
    try {
      const result = await requestLoginCode(email.trim());
      setStatus({
        loading: false,
        error: "",
        info: t("auth.codeSent", { minutes: Math.ceil(result.expiresInMs / 60000) })
      });
      setStep("code");
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
      setCode("");
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: "", info: "" });
    try {
      const result = await verifyLoginCode(email.trim(), code.trim());
      setUser(result.user);
      const profileStatus = await fetchProfileStatus();
      setHasProfile(profileStatus.hasProfile);
      setProfileCreated(profileStatus.hasProfile);
      if (!profileStatus.hasProfile) {
        await preloadOnboardingOptions();
        setSelectedStyles([]);
        setSelectedOccasions([]);
        setOnboardingStep(0);
        setStatus({ loading: false, error: "", info: "" });
      } else {
        await Promise.all([ensureOptionsLoaded(), loadProfileSelections()]);
        setStatus({ loading: false, error: "", info: t("auth.signedIn") });
      }
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
      setCode("");
    }
  };

  const handleLogout = async () => {
    setStatus({ loading: true, error: "", info: "" });
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
      setOnboardingStep(0);
      clearProfileOptionsCache();
      setStyleOptions([]);
      setOccasionOptions([]);
      setStatus({ loading: false, error: "", info: t("auth.signedOut") });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
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
    setOnboardingStep((prev) => Math.min(prev + 1, 2));
  };

  const handleBackOnboarding = () => {
    setOnboardingStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinishOnboarding = async () => {
    setStatus({ loading: true, error: "", info: "" });
    try {
      await initializeProfile(selectedStyles, selectedOccasions);
      setProfileCreated(true);
      setHasProfile(true);
      setCurrentView("main");
      setStatus({ loading: false, error: "", info: t("onboarding.step3Hint") });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
    }
  };

  const handleSaveProfile = async () => {
    setStatus({ loading: true, error: "", info: "" });
    try {
      await updateProfile(selectedStyles, selectedOccasions);
      setStatus({ loading: false, error: "", info: t("profile.updated") });
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
    }
  };

  const handleDeleteProfile = async () => {
    setStatus({ loading: true, error: "", info: "" });
    try {
      await deleteProfile();
      await handleLogout();
    } catch (error) {
      setStatus({ loading: false, error: resolveErrorMessage(error), info: "" });
    }
  };

  const handleOpenProfile = () => {
    ensureOptionsLoaded();
    setCurrentView("profile");
  };

  const handleBackToMain = () => {
    setCurrentView("main");
  };

  const renderRightPanel = () => {
    if (isCheckingSession) {
      return <LoadingScreen />;
    }

    if (!user) {
      return (
        <SignInScreen
          step={step}
          email={email}
          code={code}
          status={status}
          onEmailChange={setEmail}
          onCodeChange={setCode}
          onRequestCode={handleRequestCode}
          onVerifyCode={handleVerifyCode}
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
            selectedStyles={selectedStyles}
            selectedOccasions={selectedOccasions}
            status={status}
            onToggleStyle={(value) => toggleSelection(value, selectedStyles, setSelectedStyles)}
            onToggleOccasion={(value) =>
              toggleSelection(value, selectedOccasions, setSelectedOccasions)
            }
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
        />
      );
    }

    return (
      <OnboardingScreen
        onboardingStep={onboardingStep}
        styleOptions={styleOptions}
        occasionOptions={occasionOptions}
        selectedStyles={selectedStyles}
        selectedOccasions={selectedOccasions}
        status={status}
        onToggleStyle={(value) => toggleSelection(value, selectedStyles, setSelectedStyles)}
        onToggleOccasion={(value) =>
          toggleSelection(value, selectedOccasions, setSelectedOccasions)
        }
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
        background: "linear-gradient(140deg, #f7f4ef 0%, #edf4f2 45%, #f6fbff 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          width: 320,
          height: 320,
          top: -120,
          right: -80,
          background: "radial-gradient(circle at 30% 30%, rgba(28, 124, 124, 0.25), transparent 65%)",
          filter: "blur(4px)"
        },
        "&::after": {
          content: '""',
          position: "absolute",
          width: 240,
          height: 240,
          bottom: -120,
          left: -60,
          background: "radial-gradient(circle at 30% 30%, rgba(240, 180, 41, 0.3), transparent 65%)",
          filter: "blur(6px)"
        }
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
        {!user ? (
          <Stack spacing={3} sx={{ pr: { md: 4 } }}>
            <Typography variant="overline" color="secondary.main" sx={{ letterSpacing: 2 }}>
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
