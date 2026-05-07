import {
  Box,
  Button,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { translateOption } from "../i18n";
import {
  MultiSelectChips,
  SearchSection,
  updateMultiValue,
} from "./SearchFiltersControls";
import {
  SearchFacetSections,
  SearchProductAttributeSections,
} from "./SearchFiltersFacetSections";
import { sortCoreValues, sortItemsByLabel } from "./searchState";
import type { SearchDraftState } from "./searchState";
import type {
  PriceControls,
  SearchFilterItems,
  SearchFiltersSidebarProps,
  UpdateDraftState,
} from "./SearchFiltersSidebarTypes";

function SearchPriceSection({
  draftState,
  priceControls,
  updateDraftState,
  t,
}: {
  draftState: SearchDraftState;
  priceControls: PriceControls;
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
}) {
  const { sliderMin, sliderMax } = priceControls;

  return (
    <SearchSection title={t("search.filters.price")}>
      <Stack spacing={1.5}>
        <Box sx={{ px: 1.75, overflow: "visible" }}>
          <Slider
            value={priceControls.priceRange}
            min={sliderMin}
            max={sliderMax}
            step={1}
            onChange={priceControls.handlePriceSliderChange}
            onChangeCommitted={priceControls.handlePriceSliderCommit}
            valueLabelDisplay="auto"
            sx={{ width: "100%", display: "block" }}
          />
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <TextField
            fullWidth
            size="small"
            label={t("search.filters.min")}
            value={draftState.priceMinDraft}
            onChange={priceControls.handlePriceInputChange("priceMinDraft")}
            onBlur={priceControls.handlePriceInputBlur("priceMinDraft")}
            onKeyDown={priceControls.handlePriceInputKeyDown("priceMinDraft")}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              min: sliderMin,
              max: sliderMax,
            }}
          />
          <TextField
            fullWidth
            size="small"
            label={t("search.filters.max")}
            value={draftState.priceMaxDraft}
            onChange={priceControls.handlePriceInputChange("priceMaxDraft")}
            onBlur={priceControls.handlePriceInputBlur("priceMaxDraft")}
            onKeyDown={priceControls.handlePriceInputKeyDown("priceMaxDraft")}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              min: sliderMin,
              max: sliderMax,
            }}
          />
          <Button
            variant="outlined"
            color="inherit"
            onClick={() =>
              updateDraftState((current) => ({
                ...current,
                priceEnabled: true,
                priceMinDraft: sliderMin,
                priceMaxDraft: sliderMax,
                page: 1,
              }))
            }
            sx={{ minWidth: "auto", px: 2, height: 40 }}
          >
            {t("filters.reset")}
          </Button>
        </Stack>
      </Stack>
    </SearchSection>
  );
}

function SearchStyleSections({
  options,
  draftState,
  locale,
  updateDraftState,
  t,
}: {
  options: SearchFiltersSidebarProps["options"];
  draftState: SearchDraftState;
  locale: string;
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
}) {
  return (
    <Stack spacing={1.5}>
      <SearchSection title={t("profile.styleCoreTitle")}>
        <MultiSelectChips
          items={sortCoreValues(options.formalityLevels).map((item) => ({
            value: item,
            label: translateOption("styles", item, locale),
          }))}
          values={draftState.formalityLevel}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("formalityLevel", value))
          }
        />
      </SearchSection>
      <SearchSection title={t("profile.styleAestheticTitle")}>
        <MultiSelectChips
          items={sortItemsByLabel(
            options.styles.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale),
            })),
            locale,
          )}
          values={draftState.style}
          defaultLabel={t("search.notImportant")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("style", value))
          }
        />
      </SearchSection>
    </Stack>
  );
}

function SearchFiltersFooter({
  status,
  onApply,
  onReset,
  showApplyButton,
  t,
}: {
  status: SearchFiltersSidebarProps["status"];
  onApply: SearchFiltersSidebarProps["onApply"];
  onReset: SearchFiltersSidebarProps["onReset"];
  showApplyButton: boolean;
  t: (key: string) => string;
}) {
  return (
    <>
      <Stack direction="row" spacing={1.5}>
        {showApplyButton ? (
          <Button
            variant="contained"
            onClick={onApply}
            disabled={status.loading}
          >
            {t("filters.apply")}
          </Button>
        ) : null}
        <Button
          variant="outlined"
          color="inherit"
          onClick={onReset}
          disabled={status.loading}
        >
          {t("filters.reset")}
        </Button>
      </Stack>
      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
    </>
  );
}

function SearchFiltersSidebarFrame({
  props,
  filterItems,
  priceControls,
  updateDraftState,
  t,
  locale,
}: {
  props: SearchFiltersSidebarProps;
  filterItems: SearchFilterItems;
  priceControls: PriceControls;
  updateDraftState: UpdateDraftState;
  t: (key: string) => string;
  locale: string;
}) {
  const { draftState } = props;

  return (
    <Stack spacing={3.2} sx={{ minHeight: 0 }}>
      <SearchSection title={t("search.filters.brand")}>
        <MultiSelectChips
          items={filterItems.brandItems}
          values={draftState.brand}
          defaultLabel={t("search.all")}
          onToggle={(value) =>
            updateDraftState(updateMultiValue("brand", value))
          }
        />
      </SearchSection>
      <SearchPriceSection
        draftState={draftState}
        priceControls={priceControls}
        updateDraftState={updateDraftState}
        t={t}
      />
      <SearchFacetSections
        draftState={draftState}
        filterItems={filterItems}
        options={props.options}
        updateDraftState={updateDraftState}
        t={t}
      />
      <SearchStyleSections
        options={props.options}
        draftState={draftState}
        locale={locale}
        updateDraftState={updateDraftState}
        t={t}
      />
      <SearchProductAttributeSections
        draftState={draftState}
        filterItems={filterItems}
        updateDraftState={updateDraftState}
        t={t}
      />
      <SearchFiltersFooter
        status={props.status}
        onApply={props.onApply}
        onReset={props.onReset}
        showApplyButton={props.showApplyButton ?? true}
        t={t}
      />
    </Stack>
  );
}

export { SearchFiltersSidebarFrame };
export type { PriceControls, SearchFilterItems };
