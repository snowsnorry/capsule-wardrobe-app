import type { ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { buildCanonicalPatternOptions } from "../../../shared/patternOptions.js";
import {
  ProfileFilterActions,
  ProfileFiltersSidebarFrame,
} from "./ProfileFiltersSidebarSections";
import type {
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
} from "./ProfileFiltersSidebarTypes";

function sortPatternOptions(
  patternOptions: ProfileFilterValue[],
  locale: string,
): ProfileFilterValue[] {
  return buildCanonicalPatternOptions(patternOptions)
    .map((item) => String(item))
    .sort((left, right) => {
      if (left === "solid") {
        return -1;
      }
      if (right === "solid") {
        return 1;
      }

      return translateOption("patterns", left, locale).localeCompare(
        translateOption("patterns", right, locale),
        locale,
      );
    });
}

function getMissingRequiredFilters({
  selectedStyleCore,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  t,
}: {
  selectedStyleCore: ProfileFilterValue | null;
  selectedOccasions: ProfileFilterValue[];
  selectedSeasons: ProfileFilterValue[];
  selectedAudience: ProfileFilterValue | null;
  t: (key: string) => string;
}) {
  return [
    selectedStyleCore ? null : t("filters.required.styleCore"),
    selectedOccasions.length > 0 ? null : t("filters.required.occasions"),
    selectedSeasons.length > 0 ? null : t("filters.required.seasons"),
    selectedAudience ? null : t("filters.required.audience"),
  ].filter((value): value is string => typeof value === "string");
}

function ProfileFiltersSidebar(
  props: ProfileFiltersSidebarProps,
): ReactElement {
  const { t, locale } = useI18n();
  const actionState = getProfileFilterActionState(props, t);

  return (
    <ProfileFiltersSidebarFrame
      props={props}
      sortedPatternOptions={sortPatternOptions(props.patternOptions, locale)}
      normalizedSelectedPattern={props.selectedPattern ?? "solid"}
      missingRequiredFilters={actionState.missingRequiredFilters}
      showUnchangedFiltersHint={actionState.showUnchangedFiltersHint}
      isApplyDisabled={actionState.isApplyDisabled}
      t={t}
      locale={locale}
    />
  );
}

function getProfileFilterActionState(
  props: ProfileFiltersSidebarProps,
  t: (key: string) => string,
) {
  const missingRequiredFilters = getMissingRequiredFilters({ ...props, t });
  const isMissingRequiredFilters = missingRequiredFilters.length > 0;
  const hasFilterChanges = props.hasFilterChanges ?? true;
  const showUnchangedFiltersHint =
    !props.status.loading && !isMissingRequiredFilters && !hasFilterChanges;
  const isApplyDisabled =
    props.status.loading ||
    Boolean(props.isInteractionDisabled) ||
    isMissingRequiredFilters ||
    !hasFilterChanges;

  return {
    missingRequiredFilters,
    showUnchangedFiltersHint,
    isApplyDisabled,
  };
}

function ProfileFiltersActions(props: ProfileFiltersSidebarProps) {
  const { t } = useI18n();
  const actionState = getProfileFilterActionState(props, t);

  return <ProfileFilterActions {...actionState} props={props} t={t} />;
}

export { ProfileFiltersActions };
export default ProfileFiltersSidebar;
