import { lazy } from "react";
import type { Dispatch, FormEvent, MouseEvent, SetStateAction } from "react";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleMeta,
  CapsuleSourceMode,
  CapsuleSidebarActions,
  OutfitSetSnapshot,
  ProfileSettings,
  StatusState,
  UserLike,
  WardrobeItem,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import {
  FALLBACK_ACCENT_COLOR_OPTIONS,
  GOOGLE_CLIENT_ID,
} from "./appConstants";
import { importMainScreen } from "./mainScreenLoader";
const MainScreen = lazy(importMainScreen);
const MyWardrobeScreen = lazy(() => import("../screens/MyWardrobeScreen"));
const OnboardingScreen = lazy(() => import("../screens/OnboardingScreen"));
const ProfileScreen = lazy(() => import("../screens/ProfileScreen"));
const SearchScreen = lazy(() => import("../screens/SearchScreen"));
const SignInScreen = lazy(() => import("../screens/SignInScreen"));
const StatisticsScreen = lazy(() => import("../screens/StatisticsScreen"));
type TranslationFn = (key: string, params?: Record<string, unknown>) => string;
type ToggleSelectionFn = (
  value: string,
  selected: string[],
  setter: Dispatch<SetStateAction<string[]>>,
) => void;
type OutfitSetIndex = number | string | null | undefined;
type SharedFilterProps = {
  styleOptions: { core: string[]; aesthetics: string[] };
  occasionOptions: string[];
  orderedSeasonOptions: string[];
  audienceOptions: string[];
  patternOptions: string[];
  selectedFormalityLevel: string;
  selectedStyle: string | null;
  selectedOccasions: string[];
  selectedSeason: string[];
  selectedAudience: string;
  selectedColor: string | null;
  selectedPattern: string;
  selectedText: string;
  selectedSourceMode: CapsuleSourceMode;
  setSelectedFormalityLevel: (value: string) => void;
  setSelectedStyle: (value: string | null) => void;
  setSelectedOccasions: Dispatch<SetStateAction<string[]>>;
  setSelectedSeason: Dispatch<SetStateAction<string[]>>;
  setSelectedAudience: (value: string) => void;
  setSelectedColor: (value: string | null) => void;
  setSelectedPattern: (value: string) => void;
  setSelectedText: (value: string) => void;
  setSelectedSourceMode: (value: CapsuleSourceMode) => void;
  toggleSelection: ToggleSelectionFn;
};
type AppRouteContentProps = SharedFilterProps & {
  appRoute: AppRoute;
  currentView: string;
  hasFilterChanges: boolean;
  hasPendingAdditionalItems: boolean;
  hasProfile: boolean;
  isCheckingSession: boolean;
  isContentBusy: boolean;
  isDownloadingWardrobePdf: boolean;
  isLoadingItems: boolean;
  isPartialRegenerationLoading: boolean;
  isSigningOut: boolean;
  onboardingStep: number;
  partialRegenerationPendingUrls: string[];
  pendingImageSetIndexes: number[];
  profileCreated: boolean;
  profileItems: WardrobeItem[] | null;
  profileOutfitSets: OutfitSetSnapshot[];
  searchAutoOpenProductDetail: boolean;
  searchInitialQuery: string;
  selectedRegenerationUrls: string[];
  sessionInitialized: boolean;
  settingsProfile: ProfileSettings;
  status: StatusState;
  t: TranslationFn;
  user: UserLike | null;
  step: "email" | "code";
  email: string;
  code: string;
  activeCapsuleMeta: CapsuleMeta | null;
  capsuleList: CapsuleMeta[];
  onApplyCapsuleFilters: () => Promise<void>;
  onBackToMain: () => void;
  onBackOnboarding: () => void;
  onCancelRegenerationSelection: () => void;
  onCreateCapsule: () => Promise<void>;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDeleteOutfitSetImage: (setIndex: OutfitSetIndex) => Promise<void>;
  onDeleteProfile: () => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onFinishOnboarding: () => Promise<void>;
  onGenerateOutfitSetImage: (setIndex: OutfitSetIndex) => Promise<void>;
  onGoogleCredential: (idToken: string) => Promise<void>;
  onNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  onNextOnboarding: () => void;
  onOpenCapsule: (capsuleId: string) => Promise<void>;
  onPasskeySignIn: () => Promise<void>;
  onRefreshWardrobe: () => Promise<void>;
  onRegenerateSelectedItems: () => Promise<void>;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRequestCode: (
    event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
  ) => Promise<void>;
  onRequestSignOut: () => void;
  onResetEmail: () => void;
  onResetProfileFilters: () => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onRemoveFromMyWardrobe: (item: WardrobeItem) => Promise<void>;
  onSaveToMyWardrobe: (item: WardrobeItem) => Promise<void>;
  onSaveProfile: () => Promise<void>;
  onSaveSettings: (nextSettings: SettingsSavePayload) => Promise<void>;
  onSearchCapsules: (query: string) => Promise<CapsuleMeta[]>;
  onShareCapsule: (
    capsuleId?: string,
  ) => Promise<{ url?: string; expiresAt?: string | Date }>;
  onToggleRegenerationSelection: (item: WardrobeItem) => void;
  onVerifyCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  registerCapsuleSidebarActions: (
    actions: CapsuleSidebarActions | null,
  ) => void;
  setCode: (value: string) => void;
  setEmail: (value: string) => void;
};
function ProfileRoute(props: AppRouteContentProps) {
  return (
    <ProfileScreen
      styleOptions={props.styleOptions}
      occasionOptions={props.occasionOptions}
      seasonOptions={props.orderedSeasonOptions}
      audienceOptions={props.audienceOptions}
      accentColorOptions={FALLBACK_ACCENT_COLOR_OPTIONS}
      patternOptions={props.patternOptions}
      selectedStyleCore={props.selectedFormalityLevel}
      selectedStyleAesthetic={props.selectedStyle}
      selectedOccasions={props.selectedOccasions}
      selectedSeasons={props.selectedSeason}
      selectedAudience={props.selectedAudience}
      selectedAccentColor={props.selectedColor}
      selectedPattern={props.selectedPattern}
      selectedText={props.selectedText}
      status={props.status}
      onSelectStyleCore={props.setSelectedFormalityLevel}
      onSelectStyleAesthetic={props.setSelectedStyle}
      onToggleOccasion={(value) =>
        props.toggleSelection(
          value,
          props.selectedOccasions,
          props.setSelectedOccasions,
        )
      }
      onToggleSeason={(value) =>
        props.toggleSelection(
          value,
          props.selectedSeason,
          props.setSelectedSeason,
        )
      }
      onSelectAudience={props.setSelectedAudience}
      onSelectAccentColor={props.setSelectedColor}
      onSelectPattern={props.setSelectedPattern}
      onTextChange={props.setSelectedText}
      onSave={props.onSaveProfile}
      onDelete={props.onDeleteProfile}
      onBack={props.onBackToMain}
    />
  );
}
function MainRoute(props: AppRouteContentProps) {
  return (
    <MainScreen
      activeCapsule={props.activeCapsuleMeta}
      capsuleList={props.capsuleList}
      userEmail={props.user?.email || ""}
      userName={props.settingsProfile.fullname}
      settingsProfile={props.settingsProfile}
      onSignOut={props.onRequestSignOut}
      onSaveSettings={props.onSaveSettings}
      isSigningOut={props.isSigningOut}
      onRefreshItems={props.onRefreshWardrobe}
      onDownloadPdf={props.onDownloadWardrobePdf}
      onCreateCapsule={props.onCreateCapsule}
      onOpenCapsule={props.onOpenCapsule}
      onSaveCapsule={props.onSaveCapsule}
      onRevertCapsule={props.onRevertCapsule}
      onRenameCapsule={props.onRenameCapsule}
      onDuplicateCapsule={props.onDuplicateCapsule}
      onDeleteCapsule={props.onDeleteCapsule}
      onShareCapsule={props.onShareCapsule}
      onRemoveFromMyWardrobe={props.onRemoveFromMyWardrobe}
      onSaveToMyWardrobe={props.onSaveToMyWardrobe}
      onSearchCapsules={props.onSearchCapsules}
      items={props.profileItems || []}
      outfitSets={props.profileOutfitSets}
      isLoadingItems={props.isLoadingItems}
      isContentBusy={props.isContentBusy}
      isDownloadingPdf={props.isDownloadingWardrobePdf}
      showAdditionalItemPlaceholder={props.hasPendingAdditionalItems}
      styleOptions={props.styleOptions}
      occasionOptions={props.occasionOptions}
      seasonOptions={props.orderedSeasonOptions}
      audienceOptions={props.audienceOptions}
      accentColorOptions={FALLBACK_ACCENT_COLOR_OPTIONS}
      patternOptions={props.patternOptions}
      selectedStyleCore={props.selectedFormalityLevel}
      selectedStyleAesthetic={props.selectedStyle}
      selectedOccasions={props.selectedOccasions}
      selectedSeasons={props.selectedSeason}
      selectedAudience={props.selectedAudience}
      selectedAccentColor={props.selectedColor}
      selectedPattern={props.selectedPattern}
      selectedSourceMode={props.selectedSourceMode}
      selectedText={props.selectedText}
      hasFilterChanges={props.hasFilterChanges}
      status={props.status}
      onSelectStyleCore={props.setSelectedFormalityLevel}
      onSelectStyleAesthetic={props.setSelectedStyle}
      onToggleOccasion={(value) =>
        props.toggleSelection(
          value,
          props.selectedOccasions,
          props.setSelectedOccasions,
        )
      }
      onToggleSeason={(value) =>
        props.toggleSelection(
          value,
          props.selectedSeason,
          props.setSelectedSeason,
        )
      }
      onSelectAudience={props.setSelectedAudience}
      onSelectAccentColor={props.setSelectedColor}
      onSelectPattern={props.setSelectedPattern}
      onSelectSourceMode={props.setSelectedSourceMode}
      onTextChange={props.setSelectedText}
      onApplyFilters={props.onApplyCapsuleFilters}
      onResetFilters={props.onResetProfileFilters}
      onNavigateApp={props.onNavigateApp}
      selectedRegenerationUrls={props.selectedRegenerationUrls}
      partialRegenerationPendingUrls={props.partialRegenerationPendingUrls}
      pendingImageSetIndexes={props.pendingImageSetIndexes}
      onToggleRegenerationSelection={props.onToggleRegenerationSelection}
      onCancelRegenerationSelection={props.onCancelRegenerationSelection}
      onRegenerateSelectedItems={props.onRegenerateSelectedItems}
      onDeleteOutfitSetImage={props.onDeleteOutfitSetImage}
      onGenerateOutfitSetImage={props.onGenerateOutfitSetImage}
      isPartialRegenerationLoading={props.isPartialRegenerationLoading}
      registerCapsuleSidebarActions={props.registerCapsuleSidebarActions}
    />
  );
}
function OnboardingRoute(props: AppRouteContentProps) {
  return (
    <OnboardingScreen
      onboardingStep={props.onboardingStep}
      styleOptions={props.styleOptions}
      occasionOptions={props.occasionOptions}
      seasonOptions={props.orderedSeasonOptions}
      audienceOptions={props.audienceOptions}
      selectedStyleCore={props.selectedFormalityLevel}
      selectedStyleAesthetic={props.selectedStyle}
      selectedOccasions={props.selectedOccasions}
      selectedSeasons={props.selectedSeason}
      selectedAudience={props.selectedAudience}
      status={props.status}
      onSelectStyleCore={props.setSelectedFormalityLevel}
      onSelectStyleAesthetic={props.setSelectedStyle}
      onToggleOccasion={(value) =>
        props.toggleSelection(
          value,
          props.selectedOccasions,
          props.setSelectedOccasions,
        )
      }
      onToggleSeason={(value) =>
        props.toggleSelection(
          value,
          props.selectedSeason,
          props.setSelectedSeason,
        )
      }
      onSelectAudience={props.setSelectedAudience}
      onNext={props.onNextOnboarding}
      onBack={props.onBackOnboarding}
      onFinish={props.onFinishOnboarding}
    />
  );
}
export default function AppRouteContent(props: AppRouteContentProps) {
  if (props.isCheckingSession || !props.sessionInitialized) {
    return null;
  }
  if (!props.user) {
    return (
      <SignInScreen
        step={props.step}
        email={props.email}
        code={props.code}
        status={props.status}
        googleClientId={GOOGLE_CLIENT_ID}
        onEmailChange={props.setEmail}
        onCodeChange={props.setCode}
        onRequestCode={props.onRequestCode}
        onVerifyCode={props.onVerifyCode}
        onGoogleCredential={props.onGoogleCredential}
        onPasskeySignIn={props.onPasskeySignIn}
        onResetEmail={props.onResetEmail}
      />
    );
  }
  if (props.hasProfile || props.profileCreated) {
    if (props.appRoute === "explore") {
      return (
        <SearchScreen
          initialQuery={props.searchInitialQuery}
          autoOpenProductDetail={props.searchAutoOpenProductDetail}
          onRemoveFromMyWardrobe={props.onRemoveFromMyWardrobe}
          onSaveToMyWardrobe={props.onSaveToMyWardrobe}
        />
      );
    }
    if (props.appRoute === "myWardrobe") {
      return <MyWardrobeScreen />;
    }
    if (props.appRoute === "statistics") {
      return <StatisticsScreen onNavigateApp={props.onNavigateApp} />;
    }
    return props.currentView === "profile" ? (
      <ProfileRoute {...props} />
    ) : (
      <MainRoute {...props} />
    );
  }
  return <OnboardingRoute {...props} />;
}
