import { Box, Button, Chip, Slider, Stack, TextField, Typography } from "@mui/material";
import type { ReactNode } from "react";
import AccentColorChips from "../components/AccentColorChips";
import { translateOption } from "../i18n";
import { sortCoreValues, sortItemsByLabel, toggleSelection } from "./searchState";
import type { SearchDraftState } from "./searchState";
import type {
  PriceControls,
  SearchFilterItems,
  SearchFiltersSidebarProps,
  SelectItem,
  UpdateDraftState
} from "./SearchFiltersSidebarTypes";

function SearchSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
      {hint ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : null}
      {children}
    </Stack>
  );
}

function MultiSelectChips({
  items,
  values,
  onToggle,
  defaultLabel,
  defaultPosition = "start"
}: {
  items: SelectItem[];
  values: string[];
  onToggle: (value: string | null) => void;
  defaultLabel?: string;
  defaultPosition?: "start" | "end";
}) {
  const defaultChip = defaultLabel ? (
    <Chip label={defaultLabel} clickable color={values.length === 0 ? "primary" : "default"} onClick={() => onToggle(null)} />
  ) : null;

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {defaultPosition === "start" ? defaultChip : null}
      {items.map((item) => <Chip key={item.value} label={item.label} clickable color={values.includes(item.value) ? "primary" : "default"} onClick={() => onToggle(item.value)} />)}
      {defaultPosition === "end" ? defaultChip : null}
    </Stack>
  );
}

function updateMultiValue(field: keyof SearchDraftState, value: string | null) {
  return (current: SearchDraftState) => ({
    ...current,
    [field]: value === null ? [] : toggleSelection(value, current[field] as string[]),
    page: 1
  });
}

function SearchPriceSection({
  draftState,
  priceControls,
  updateDraftState,
  t
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
          <Slider value={priceControls.priceRange} min={sliderMin} max={sliderMax} step={1} onChange={priceControls.handlePriceSliderChange} onChangeCommitted={priceControls.handlePriceSliderCommit} valueLabelDisplay="auto" sx={{ width: "100%", display: "block" }} />
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <TextField fullWidth size="small" label={t("search.filters.min")} value={draftState.priceMinDraft} onChange={priceControls.handlePriceInputChange("priceMinDraft")} onBlur={priceControls.handlePriceInputBlur("priceMinDraft")} onKeyDown={priceControls.handlePriceInputKeyDown("priceMinDraft")} inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: sliderMin, max: sliderMax }} />
          <TextField fullWidth size="small" label={t("search.filters.max")} value={draftState.priceMaxDraft} onChange={priceControls.handlePriceInputChange("priceMaxDraft")} onBlur={priceControls.handlePriceInputBlur("priceMaxDraft")} onKeyDown={priceControls.handlePriceInputKeyDown("priceMaxDraft")} inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: sliderMin, max: sliderMax }} />
          <Button variant="outlined" color="inherit" onClick={() => updateDraftState((current) => ({ ...current, priceEnabled: true, priceMinDraft: sliderMin, priceMaxDraft: sliderMax, page: 1 }))} sx={{ minWidth: "auto", px: 2, height: 40 }}>{t("filters.reset")}</Button>
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
  t
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
        <MultiSelectChips items={sortCoreValues(options.formalityLevels).map((item) => ({ value: item, label: translateOption("styles", item, locale) }))} values={draftState.formalityLevel} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("formalityLevel", value))} />
      </SearchSection>
      <SearchSection title={t("profile.styleAestheticTitle")}>
        <MultiSelectChips items={sortItemsByLabel(options.styles.map((item) => ({ value: item, label: translateOption("styles", item, locale) })), locale)} values={draftState.style} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("style", value))} />
      </SearchSection>
    </Stack>
  );
}

function SearchFiltersFooter({
  status,
  onApply,
  onReset,
  showApplyButton,
  t
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
        {showApplyButton ? <Button variant="contained" onClick={onApply} disabled={status.loading}>{t("filters.apply")}</Button> : null}
        <Button variant="outlined" color="inherit" onClick={onReset} disabled={status.loading}>{t("filters.reset")}</Button>
      </Stack>
      {status.error ? <Typography variant="body2" color="error">{status.error}</Typography> : null}
    </>
  );
}

function SearchFiltersSidebarFrame({
  props,
  filterItems,
  priceControls,
  updateDraftState,
  t,
  locale
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
      <SearchSection title={t("search.filters.brand")}><MultiSelectChips items={filterItems.brandItems} values={draftState.brand} defaultLabel={t("search.all")} onToggle={(value) => updateDraftState(updateMultiValue("brand", value))} /></SearchSection>
      <SearchPriceSection draftState={draftState} priceControls={priceControls} updateDraftState={updateDraftState} t={t} />
      <SearchSection title={t("profile.audienceTitle")}><MultiSelectChips items={filterItems.audienceItems} values={draftState.audience} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("audience", value))} /></SearchSection>
      <SearchSection title={t("search.filters.category")}><MultiSelectChips items={filterItems.categoryItems} values={draftState.category} defaultLabel={t("search.all")} onToggle={(value) => updateDraftState(updateMultiValue("category", value))} /></SearchSection>
      <SearchSection title={t("profile.seasonsTitle")}><MultiSelectChips items={filterItems.seasonItems} values={draftState.season} defaultLabel={t("search.all")} onToggle={(value) => updateDraftState(updateMultiValue("season", value))} /></SearchSection>
      <SearchStyleSections options={props.options} draftState={draftState} locale={locale} updateDraftState={updateDraftState} t={t} />
      <SearchSection title={t("profile.occasionsTitle")}><MultiSelectChips items={filterItems.occasionItems} values={draftState.occasions} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("occasions", value))} /></SearchSection>
      <SearchSection title={t("profile.accentColorTitle")}><AccentColorChips options={props.options.colors} selectedValues={draftState.color} emptyLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("color", value))} /></SearchSection>
      <SearchSection title={t("profile.patternTitle")}><MultiSelectChips items={filterItems.patternItems} values={draftState.pattern} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("pattern", value))} /></SearchSection>
      <SearchSection title={t("search.filters.silhouette")}><MultiSelectChips items={filterItems.silhouetteItems} values={draftState.silhouette} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("silhouette", value))} /></SearchSection>
      <SearchSection title={t("search.filters.fit")}><MultiSelectChips items={filterItems.fitItems} values={draftState.fit} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("fit", value))} /></SearchSection>
      <SearchSection title={t("search.filters.closureType")}><MultiSelectChips items={filterItems.closureTypeItems} values={draftState.closureType} defaultLabel={t("search.notImportant")} onToggle={(value) => updateDraftState(updateMultiValue("closureType", value))} /></SearchSection>
      <SearchFiltersFooter status={props.status} onApply={props.onApply} onReset={props.onReset} showApplyButton={props.showApplyButton ?? true} t={t} />
    </Stack>
  );
}

export { SearchFiltersSidebarFrame };
export type { PriceControls, SearchFilterItems };
