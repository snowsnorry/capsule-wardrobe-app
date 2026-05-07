import type { ReactElement } from "react";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { buildCanonicalPatternOptions } from "../../../shared/patternOptions.js";
import { ProfileFiltersSidebarFrame } from "./ProfileFiltersSidebarSections";
import type {
  ProfileFiltersSidebarProps,
  ProfileFiltersStatus,
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

  return (
    <ProfileFiltersSidebarFrame
      props={props}
      sortedPatternOptions={sortPatternOptions(props.patternOptions, locale)}
      normalizedSelectedPattern={props.selectedPattern ?? "solid"}
      missingRequiredFilters={missingRequiredFilters}
      showUnchangedFiltersHint={showUnchangedFiltersHint}
      isApplyDisabled={isApplyDisabled}
      t={t}
      locale={locale}
    />
  );
}

export type { ProfileFiltersSidebarProps, ProfileFiltersStatus };
export default ProfileFiltersSidebar;
