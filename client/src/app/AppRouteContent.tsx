import { lazy } from "react";
import {
  FALLBACK_ACCENT_COLOR_OPTIONS,
  GOOGLE_CLIENT_ID,
} from "./appConstants";
import { importMainScreen } from "./mainScreenLoader";
import type { AppRouteContentProps } from "./AppRouteContentTypes";
const MainScreen = lazy(importMainScreen);
const WardrobeScreen = lazy(() => import("../screens/WardrobeScreen"));
const ProfileScreen = lazy(() => import("../screens/ProfileScreen"));
const SearchScreen = lazy(() => import("../screens/SearchScreen"));
const SignInScreen = lazy(() => import("../screens/SignInScreen"));
const StatisticsScreen = lazy(() => import("../screens/StatisticsScreen"));
const OutfitScreen = lazy(() => import("../screens/outfitScreen/OutfitScreen"));

function toggleMainOccasion(props: AppRouteContentProps, value: string) {
  props.toggleSelection(
    value,
    props.selectedOccasions,
    props.setSelectedOccasions,
  );
}

function toggleMainSeason(props: AppRouteContentProps, value: string) {
  props.toggleSelection(value, props.selectedSeason, props.setSelectedSeason);
}
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
      onSetCapsulePin={props.onSetCapsulePin}
      onDuplicateCapsule={props.onDuplicateCapsule}
      onDeleteCapsule={props.onDeleteCapsule}
      onDeleteCapsuleReport={props.onDeleteCapsuleReport}
      onShareCapsule={props.onShareCapsule}
      onRemoveFromPersonalItems={props.onRemoveFromPersonalItems}
      onSaveToPersonalItems={props.onSaveToPersonalItems}
      onSetItemLike={props.onSetItemLike}
      onUpdateUploadedWardrobeItem={props.onUpdateUploadedWardrobeItem}
      onSearchCapsules={props.onSearchCapsules}
      onCopyOutfitSetToOutfits={props.onCopyOutfitSetToOutfits}
      onOpenOutfit={props.onOpenOutfit}
      items={props.profileItems || []}
      outfitSets={props.profileOutfitSets}
      isLoadingItems={props.isLoadingItems}
      isCapsuleReportPending={props.isCapsuleReportPending}
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
      selectedAnchorItemRefs={props.selectedAnchorItemRefs}
      hasFilterChanges={props.hasFilterChanges}
      status={props.status}
      onSelectStyleCore={props.setSelectedFormalityLevel}
      onSelectStyleAesthetic={props.setSelectedStyle}
      onToggleOccasion={(value) => toggleMainOccasion(props, value)}
      onToggleSeason={(value) => toggleMainSeason(props, value)}
      onSelectAudience={props.setSelectedAudience}
      onSelectAccentColor={props.setSelectedColor}
      onSelectPattern={props.setSelectedPattern}
      onSelectSourceMode={props.setSelectedSourceMode}
      onTextChange={props.setSelectedText}
      onSelectAnchorItemRefs={props.setSelectedAnchorItemRefs}
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
      onGenerateCapsuleReport={props.onGenerateCapsuleReport}
      onGenerateOutfitSetImage={props.onGenerateOutfitSetImage}
      isPartialRegenerationLoading={props.isPartialRegenerationLoading}
      registerCapsuleSidebarActions={props.registerCapsuleSidebarActions}
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
          onRemoveFromPersonalItems={props.onRemoveFromPersonalItems}
          onSaveToPersonalItems={props.onSaveToPersonalItems}
          onSetItemLike={props.onSetItemLike}
        />
      );
    }
    if (props.appRoute === "wardrobe") {
      return <WardrobeScreen />;
    }
    if (props.appRoute === "statistics") {
      return <StatisticsScreen onNavigateApp={props.onNavigateApp} />;
    }
    if (props.appRoute === "outfit") {
      return (
        <OutfitScreen
          activeOutfit={props.activeOutfitMeta}
          isContentBusy={props.isContentBusy}
          isImagePending={props.isOutfitImagePending}
          isReportPending={props.isOutfitReportPending}
          onDeleteOutfit={props.onDeleteOutfit}
          onDeleteOutfitImage={props.onDeleteOutfitImage}
          onDeleteOutfitReport={props.onDeleteOutfitReport}
          onDownloadOutfitPdf={props.onDownloadOutfitPdf}
          onDuplicateOutfit={props.onDuplicateOutfit}
          onGenerateOutfitImage={props.onGenerateOutfitImage}
          onGenerateOutfitReport={props.onGenerateOutfitReport}
          onRenameOutfit={props.onRenameOutfit}
          onReplaceOutfitItems={props.onReplaceOutfitItems}
          onRemoveFromPersonalItems={props.onRemoveFromPersonalItems}
          onRevertOutfit={props.onRevertOutfit}
          onSaveToPersonalItems={props.onSaveToPersonalItems}
          onSaveOutfit={props.onSaveOutfit}
          onSetOutfitPin={props.onSetOutfitPin}
          onSetItemLike={props.onSetItemLike}
          onUpdateUploadedWardrobeItem={props.onUpdateUploadedWardrobeItem}
        />
      );
    }
    return props.currentView === "profile" ? (
      <ProfileRoute {...props} />
    ) : (
      <MainRoute {...props} />
    );
  }
  return null;
}
