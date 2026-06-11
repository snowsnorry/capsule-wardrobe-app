import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  getCapsuleCategoryShortfalls,
  getReadyWardrobeCapsuleItems,
} from "../../../shared/capsuleCategories.js";
import { fetchPersonalItems } from "../api/personalItems";
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
  ProfileFiltersSourceModeStatus,
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
  const sourceModeStatus = useWardrobeOnlySourceModeStatus(props, t, locale);
  const resolvedProps = { ...props, sourceModeStatus };
  const actionState = getProfileFilterActionState(resolvedProps, t);

  return (
    <ProfileFiltersSidebarFrame
      props={resolvedProps}
      sortedPatternOptions={sortPatternOptions(props.patternOptions, locale)}
      normalizedSelectedPattern={props.selectedPattern ?? ""}
      missingRequiredFilters={actionState.missingRequiredFilters}
      showUnchangedFiltersHint={actionState.showUnchangedFiltersHint}
      isApplyDisabled={actionState.isApplyDisabled}
      t={t}
      locale={locale}
    />
  );
}

function useWardrobeOnlySourceModeStatus(
  props: ProfileFiltersSidebarProps,
  t: (key: string, params?: Record<string, unknown>) => string,
  locale: string,
): ProfileFiltersSourceModeStatus | null {
  const [state, setState] = useState<{
    error: boolean;
    items: Array<Record<string, unknown>>;
    loading: boolean;
  }>({ error: false, items: [], loading: false });

  useEffect(() => {
    if (props.selectedSourceMode !== "wardrobe_only") {
      setState({ error: false, items: [], loading: false });
      return;
    }

    let current = true;
    setState((previous) => ({ ...previous, error: false, loading: true }));
    fetchPersonalItems({ force: true })
      .then((response) => {
        if (!current) return;
        setState({
          error: false,
          items: Array.isArray(response?.items)
            ? (response.items as Array<Record<string, unknown>>)
            : [],
          loading: false,
        });
      })
      .catch(() => {
        if (!current) return;
        setState({ error: true, items: [], loading: false });
      });

    return () => {
      current = false;
    };
  }, [props.selectedSourceMode]);

  return useMemo(
    () =>
      buildWardrobeOnlySourceModeStatus({
        items: state.items,
        locale,
        loading: state.loading,
        loadFailed: state.error,
        selectedAudience: props.selectedAudience,
        selectedAnchorItemRefs: props.selectedAnchorItemRefs || [],
        selectedSeasons: props.selectedSeasons,
        selectedSourceMode: props.selectedSourceMode,
        t,
      }),
    [
      locale,
      props.selectedAudience,
      props.selectedAnchorItemRefs,
      props.selectedSeasons,
      props.selectedSourceMode,
      state.error,
      state.items,
      state.loading,
      t,
    ],
  );
}

function buildWardrobeOnlySourceModeStatus({
  items,
  locale,
  loading,
  loadFailed,
  selectedAudience,
  selectedAnchorItemRefs,
  selectedSeasons,
  selectedSourceMode,
  t,
}: {
  items: Array<Record<string, unknown>>;
  locale: string;
  loading: boolean;
  loadFailed: boolean;
  selectedAudience: string | null;
  selectedAnchorItemRefs: Array<{
    source: "uploaded" | "from_catalog";
    url: string;
  }>;
  selectedSeasons: string[];
  selectedSourceMode: ProfileFiltersSidebarProps["selectedSourceMode"];
  t: (key: string, params?: Record<string, unknown>) => string;
}): ProfileFiltersSourceModeStatus | null {
  if (selectedSourceMode !== "wardrobe_only") {
    return null;
  }

  if (loading) {
    return {
      isBlocking: true,
      message: t("capsule.sourceMode.checkingWardrobe"),
      severity: "info",
    };
  }

  if (loadFailed) {
    return {
      isBlocking: true,
      message: t("capsule.sourceMode.loadFailed"),
      severity: "error",
    };
  }

  const readyItems = getReadyWardrobeCapsuleItems(items);
  if (readyItems.length === 0) {
    return {
      isBlocking: true,
      message: t("capsule.sourceMode.emptyWardrobe"),
      severity: "error",
    };
  }

  const shortfalls = getCapsuleCategoryShortfalls({
    anchorItems: getSelectedReadyAnchorItems(items, selectedAnchorItemRefs),
    includeSwimwear: true,
    items,
    profile: {
      audience: selectedAudience || "",
      season: selectedSeasons,
    },
  });
  if (shortfalls.length > 0) {
    return {
      isBlocking: false,
      message: t("capsule.sourceMode.insufficientWardrobe", {
        count: readyItems.length,
        items: shortfalls
          .map(
            (item) =>
              `${translateOption("categories", item.category, locale)}: ${
                item.missing
              }`,
          )
          .join(", "),
      }),
      severity: "warning",
    };
  }

  return null;
}

function getSelectedReadyAnchorItems(
  items: Array<Record<string, unknown>>,
  selectedAnchorItemRefs: Array<{
    source: "uploaded" | "from_catalog";
    url: string;
  }>,
) {
  const selectedRefs = new Set(
    selectedAnchorItemRefs
      .map((ref) =>
        ref.url ? `${ref.source}\u0000${String(ref.url).trim()}` : "",
      )
      .filter(Boolean),
  );
  return getReadyWardrobeCapsuleItems(items).filter((item) => {
    const source = item as Record<string, unknown>;
    return selectedRefs.has(
      `${
        source.source === "uploaded" ? "uploaded" : "from_catalog"
      }\u0000${String(source.url || "").trim()}`,
    );
  });
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
    Boolean(props.sourceModeStatus?.isBlocking) ||
    isMissingRequiredFilters ||
    !hasFilterChanges;

  return {
    missingRequiredFilters,
    showUnchangedFiltersHint,
    isApplyDisabled,
  };
}

function ProfileFiltersActions(props: ProfileFiltersSidebarProps) {
  const { t, locale } = useI18n();
  const sourceModeStatus = useWardrobeOnlySourceModeStatus(props, t, locale);
  const resolvedProps = { ...props, sourceModeStatus };
  const actionState = getProfileFilterActionState(resolvedProps, t);

  return <ProfileFilterActions {...actionState} props={resolvedProps} t={t} />;
}

export { ProfileFiltersActions };
export default ProfileFiltersSidebar;
