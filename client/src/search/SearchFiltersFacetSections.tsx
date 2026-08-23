import { Stack } from "@mui/material";
import AccentColorChips from "../components/AccentColorChips";
import { PatternSwatch } from "../components/PatternSwatch";
import ExactColorFilter from "./ExactColorFilter";
import {
  MultiSelectChips,
  SearchSection,
  updateMultiValue,
} from "./SearchFiltersControls";
import type { SearchDraftState } from "./searchState";
import type {
  SearchFilterItems,
  SearchFiltersSidebarProps,
  UpdateDraftState,
} from "./SearchFiltersSidebarTypes";

function ExactColorFilterSection({
  draftState,
  updateDraftState,
  t,
}: {
  draftState: SearchDraftState;
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
}) {
  return (
    <ExactColorFilter
      value={draftState.exactColor}
      range={draftState.exactColorRange}
      t={t}
      onChange={(exactColor) =>
        updateDraftState((current) => ({ ...current, exactColor, page: 1 }))
      }
      onRangeChange={(exactColorRange) =>
        updateDraftState(
          (current) => ({ ...current, exactColorRange, page: 1 }),
          { submit: false },
        )
      }
      onRangeChangeCommitted={(exactColorRange) =>
        updateDraftState(
          (current) => ({ ...current, exactColorRange, page: 1 }),
          { submit: true },
        )
      }
    />
  );
}

function SearchFacetSections({
  draftState,
  filterItems,
  options,
  updateDraftState,
  t,
  showExactColorFilter,
}: {
  draftState: SearchDraftState;
  filterItems: SearchFilterItems;
  options: SearchFiltersSidebarProps["options"];
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
  showExactColorFilter: boolean;
}) {
  return (
    <>
      <SearchSection title={t("profile.audienceTitle")}>
        <MultiSelectChips
          items={filterItems.audienceItems}
          values={draftState.audience}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("audience", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("search.filters.category")}>
        <MultiSelectChips
          items={filterItems.categoryItems}
          values={draftState.category}
          defaultLabel={t("search.all")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("category", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("profile.seasonsTitle")}>
        <MultiSelectChips
          items={filterItems.seasonItems}
          values={draftState.season}
          defaultLabel={t("search.all")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("season", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("profile.occasionsTitle")}>
        <MultiSelectChips
          items={filterItems.occasionItems}
          values={draftState.occasions}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("occasions", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("profile.accentColorTitle")}>
        <AccentColorChips
          options={options.colors}
          selectedValues={draftState.color}
          emptyLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("color", value))
          }
        />
      </SearchSection>
      {showExactColorFilter ? (
        <ExactColorFilterSection
          draftState={draftState}
          updateDraftState={updateDraftState}
          t={t}
        />
      ) : null}
    </>
  );
}

function SearchProductAttributeSections({
  draftState,
  filterItems,
  updateDraftState,
  t,
}: {
  draftState: SearchDraftState;
  filterItems: SearchFilterItems;
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
}) {
  return (
    <Stack spacing={3.2}>
      <SearchSection title={t("profile.patternTitle")}>
        <MultiSelectChips
          items={filterItems.patternItems}
          values={draftState.pattern}
          defaultLabel={t("search.notImportant")}
          renderPrefix={(value) => <PatternSwatch pattern={value} />}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("pattern", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("search.filters.silhouette")}>
        <MultiSelectChips
          items={filterItems.silhouetteItems}
          values={draftState.silhouette}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("silhouette", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("search.filters.fit")}>
        <MultiSelectChips
          items={filterItems.fitItems}
          values={draftState.fit}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) => updateDraftState(updateMultiValue("fit", value))}
        />
      </SearchSection>
      <SearchSection title={t("search.filters.closureType")}>
        <MultiSelectChips
          items={filterItems.closureTypeItems}
          values={draftState.closureType}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("closureType", value))
          }
        />
      </SearchSection>
    </Stack>
  );
}

export { SearchFacetSections, SearchProductAttributeSections };
