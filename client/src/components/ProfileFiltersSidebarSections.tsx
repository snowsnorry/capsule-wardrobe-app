import { Divider, Stack, Typography } from "@mui/material";
import ProfileFiltersAnchorSection from "./ProfileFiltersAnchorSection";
import {
  ProfileFilterActions,
  ProfileSignOutAction,
} from "./ProfileFiltersSidebarActions";
import {
  ProfileFilterControls,
  ProfileTextSection,
} from "./ProfileFiltersSidebarControls";
import { SourceModeSelect } from "./ProfileFiltersSidebarSourceMode";
import type {
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
} from "./ProfileFiltersSidebarTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function ProfileFiltersHeader({
  disabled,
  props,
  showTitle,
  t,
  locale,
}: {
  disabled: boolean;
  props: ProfileFiltersSidebarProps;
  showTitle: boolean;
  t: Translate;
  locale: string;
}) {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        {showTitle ? (
          <Typography variant="h6" sx={{ color: "text.primary" }}>
            {t("capsule.settingsTitle")}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t("capsule.settingsSubtitle")}
        </Typography>
        <SourceModeSelect disabled={disabled} props={props} t={t} />
      </Stack>
      <Divider />
      <ProfileFiltersAnchorSection
        anchorPickerFullScreen={props.anchorPickerFullScreen}
        disabled={disabled}
        selectedRefs={props.selectedAnchorItemRefs || []}
        onRefsChange={props.onSelectAnchorItemRefs}
        t={t}
        locale={locale}
      />
      <Divider />
    </Stack>
  );
}

function ProfileFiltersSidebarFrame({
  props,
  sortedPatternOptions,
  normalizedSelectedPattern,
  missingRequiredFilters,
  showUnchangedFiltersHint,
  isApplyDisabled,
  t,
  locale,
}: {
  props: ProfileFiltersSidebarProps;
  sortedPatternOptions: ProfileFilterValue[];
  normalizedSelectedPattern: ProfileFilterValue;
  missingRequiredFilters: string[];
  showUnchangedFiltersHint: boolean;
  isApplyDisabled: boolean;
  t: Translate;
  locale: string;
}) {
  const disabled = Boolean(props.isInteractionDisabled);

  return (
    <Stack spacing={3.5} sx={{ boxSizing: "border-box" }}>
      <ProfileFiltersHeader
        disabled={disabled}
        props={props}
        showTitle={props.showSettingsTitle !== false}
        t={t}
        locale={locale}
      />
      <ProfileFilterControls
        disabled={disabled}
        locale={locale}
        normalizedSelectedPattern={normalizedSelectedPattern}
        props={props}
        sortedPatternOptions={sortedPatternOptions}
        t={t}
      />
      <ProfileTextSection
        selectedText={props.selectedText}
        disabled={disabled}
        onTextChange={props.onTextChange}
        t={t}
      />
      {props.showFooterActions === false ? null : (
        <ProfileFilterActions
          missingRequiredFilters={missingRequiredFilters}
          showUnchangedFiltersHint={showUnchangedFiltersHint}
          isApplyDisabled={isApplyDisabled}
          props={props}
          t={t}
        />
      )}
      <ProfileSignOutAction
        onSignOut={props.onSignOut}
        isSigningOut={props.isSigningOut}
        t={t}
      />
    </Stack>
  );
}

export { ProfileFilterActions, ProfileFiltersSidebarFrame };
