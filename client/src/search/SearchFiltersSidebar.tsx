import { Box, Button, Chip, Slider, Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import AccentColorChips from "../components/AccentColorChips";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n";
import {
  clampPriceValue,
  normalizeBrandOption,
  sortAudienceValues,
  sortCoreValues,
  sortItemsByLabel,
  sortSeasonValues,
  toggleSelection
} from "./searchState.js";

import type { SearchDraftState, SearchOptions } from "./searchState.js";

type SearchFiltersStatus = {
  loading: boolean;
  error: string;
};

type SearchStateUpdater = SearchDraftState | ((current: SearchDraftState) => SearchDraftState);

type SearchFiltersSidebarProps = {
  options: SearchOptions;
  draftState: SearchDraftState;
  onDraftStateChange: (updater: SearchStateUpdater, options?: { submit?: boolean }) => void | Promise<void>;
  status: SearchFiltersStatus;
  onApply: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  autoApply?: boolean;
  showApplyButton?: boolean;
};

type SearchSectionProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

type SelectItem = {
  value: string;
  label: string;
};

type MultiSelectChipsProps = {
  items: SelectItem[];
  values: string[];
  onToggle: (value: string | null) => void;
  defaultLabel?: string;
  defaultPosition?: "start" | "end";
};

function SearchSection({ title, hint, children }: SearchSectionProps) {
  return (
    <Stack spacing={1.3}>
      <Typography variant="h6">{title}</Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
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
}: MultiSelectChipsProps) {
  const defaultChip = defaultLabel ? (
    <Chip
      label={defaultLabel}
      clickable
      color={values.length === 0 ? "primary" : "default"}
      onClick={() => onToggle(null)}
    />
  ) : null;

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {defaultPosition === "start" ? defaultChip : null}
      {items.map((item) => (
        <Chip
          key={item.value}
          label={item.label}
          clickable
          color={values.includes(item.value) ? "primary" : "default"}
          onClick={() => onToggle(item.value)}
        />
      ))}
      {defaultPosition === "end" ? defaultChip : null}
    </Stack>
  );
}

function SearchFiltersSidebar({
  options,
  draftState,
  onDraftStateChange,
  status,
  onApply,
  onReset,
  autoApply = false,
  showApplyButton = true
}: SearchFiltersSidebarProps) {
  const { t, locale } = useI18n();
  const brandItems = options.brands.map(normalizeBrandOption).filter(Boolean);
  const categoryItems = options.categories.map((item) => ({
    value: item,
    label: translateOption("categories", item, locale)
  }));
  const seasonItems = sortSeasonValues(options.seasons).map((item) => ({
    value: item,
    label: translateOption("seasons", item, locale)
  }));
  const audienceItems = sortAudienceValues(options.audience).map((item) => ({
    value: item,
    label: translateOption("audience", item, locale)
  }));
  const occasionItems = options.occasions.map((item) => ({
    value: item,
    label: translateOption("occasions", item, locale)
  }));
  const patternItems = sortItemsByLabel(options.patterns.map((item) => ({
    value: item,
    label: translateOption("patterns", item, locale)
  })), locale);
  const silhouetteItems = options.silhouettes.map((item) => ({
    value: item,
    label: translateOption("silhouettes", item, locale)
  }));
  const fitItems = options.fits.map((item) => ({
    value: item,
    label: translateOption("fits", item, locale)
  }));
  const closureTypeItems = options.closureTypes.map((item) => ({
    value: item,
    label: translateOption("closureTypes", item, locale)
  }));

  const sliderMin = options.priceRange.min ?? 0;
  const sliderMax = options.priceRange.max ?? 1000;
  const priceRange = [
    clampPriceValue(draftState.priceMinDraft, sliderMin, sliderMax),
    clampPriceValue(draftState.priceMaxDraft, sliderMin, sliderMax)
  ];

  const updateDraftState = (updater: SearchStateUpdater, { submit = autoApply } = {}) => {
    onDraftStateChange(updater, { submit });
  };

  const handlePriceSliderChange = (_event: Event, nextValue: number | number[]) => {
    if (!Array.isArray(nextValue)) {
      return;
    }
    updateDraftState((current) => ({
      ...current,
      priceEnabled: true,
      priceMinDraft: nextValue[0],
      priceMaxDraft: nextValue[1],
      page: 1
    }), { submit: false });
  };

  const handlePriceSliderCommit = (_event: Event | React.SyntheticEvent<Element, Event>, nextValue: number | number[]) => {
    if (!Array.isArray(nextValue)) {
      return;
    }
    updateDraftState((current) => ({
      ...current,
      priceEnabled: true,
      priceMinDraft: nextValue[0],
      priceMaxDraft: nextValue[1],
      page: 1
    }));
  };

  const handlePriceInputChange = (field: "priceMinDraft" | "priceMaxDraft") => (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    updateDraftState((current) => ({
      ...current,
      priceEnabled: true,
      [field]: rawValue,
      page: 1
    }), { submit: false });
  };

  const handlePriceInputBlur = (field: "priceMinDraft" | "priceMaxDraft") => () => {
    updateDraftState((current) => {
      const currentMin = clampPriceValue(current.priceMinDraft, sliderMin, sliderMax);
      const currentMax = clampPriceValue(current.priceMaxDraft, sliderMin, sliderMax);
      let nextMin = currentMin;
      let nextMax = currentMax;

      if (field === "priceMinDraft") {
        nextMin = clampPriceValue(current.priceMinDraft, sliderMin, sliderMax);
        nextMin = Math.min(nextMin, currentMax);
      }

      if (field === "priceMaxDraft") {
        nextMax = clampPriceValue(current.priceMaxDraft, sliderMin, sliderMax);
        nextMax = Math.max(nextMax, currentMin);
      }

      if (field !== "priceMinDraft" && nextMin > nextMax) {
        nextMin = nextMax;
      }

      if (field !== "priceMaxDraft" && nextMax < nextMin) {
        nextMax = nextMin;
      }

      return {
        ...current,
        priceEnabled: true,
        priceMinDraft: nextMin,
        priceMaxDraft: nextMax,
        page: 1
      };
    });
  };

  const handlePriceInputKeyDown = (field: "priceMinDraft" | "priceMaxDraft") => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    handlePriceInputBlur(field)();
  };

  return (
    <Stack spacing={3.2} sx={{ minHeight: 0 }}>
      <SearchSection title={t("search.filters.brand")}>
        <MultiSelectChips
          items={brandItems}
          values={draftState.brand}
          defaultLabel={t("search.all")}
          onToggle={(brand) => updateDraftState((current) => ({
            ...current,
            brand: brand === null ? [] : toggleSelection(brand, current.brand),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.price")}>
        <Stack spacing={1.5}>
          <Box sx={{ px: 1.75, overflow: "visible" }}>
            <Slider
              value={priceRange}
              min={sliderMin}
              max={sliderMax}
              step={1}
              onChange={handlePriceSliderChange}
              onChangeCommitted={handlePriceSliderCommit}
              valueLabelDisplay="auto"
              sx={{
                width: "100%",
                display: "block"
              }}
            />
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <TextField
              fullWidth
              size="small"
              label={t("search.filters.min")}
              value={draftState.priceMinDraft}
              onChange={handlePriceInputChange("priceMinDraft")}
              onBlur={handlePriceInputBlur("priceMinDraft")}
              onKeyDown={handlePriceInputKeyDown("priceMinDraft")}
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
                min: sliderMin,
                max: sliderMax
              }}
            />
            <TextField
              fullWidth
              size="small"
              label={t("search.filters.max")}
              value={draftState.priceMaxDraft}
              onChange={handlePriceInputChange("priceMaxDraft")}
              onBlur={handlePriceInputBlur("priceMaxDraft")}
              onKeyDown={handlePriceInputKeyDown("priceMaxDraft")}
              inputProps={{
                inputMode: "numeric",
                pattern: "[0-9]*",
                min: sliderMin,
                max: sliderMax
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
                  page: 1
                }))
              }
              sx={{ minWidth: "auto", px: 2, height: 40 }}
            >
              {t("filters.reset")}
            </Button>
          </Stack>
        </Stack>
      </SearchSection>

      <SearchSection title={t("profile.audienceTitle")}>
        <MultiSelectChips
          items={audienceItems}
          values={draftState.audience}
          defaultLabel={t("search.notImportant")}
          onToggle={(audience) => updateDraftState((current) => ({
            ...current,
            audience: audience === null ? [] : toggleSelection(audience, current.audience),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.category")}>
        <MultiSelectChips
          items={categoryItems}
          values={draftState.category}
          defaultLabel={t("search.all")}
          onToggle={(category) => updateDraftState((current) => ({
            ...current,
            category: category === null ? [] : toggleSelection(category, current.category),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.seasonsTitle")}>
        <MultiSelectChips
          items={seasonItems}
          values={draftState.season}
          defaultLabel={t("search.all")}
          onToggle={(season) => updateDraftState((current) => ({
            ...current,
            season: season === null ? [] : toggleSelection(season, current.season),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.stylesTitle")}>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("profile.styleCoreTitle")}
          </Typography>
          <MultiSelectChips
            items={sortCoreValues(options.formalityLevels).map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            }))}
            values={draftState.formalityLevel}
            defaultLabel={t("search.notImportant")}
            onToggle={(formalityLevel) => updateDraftState((current) => ({
              ...current,
              formalityLevel: formalityLevel === null ? [] : toggleSelection(formalityLevel, current.formalityLevel),
              page: 1
            }))}
          />
        </Stack>
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("profile.styleAestheticTitle")}
          </Typography>
          <MultiSelectChips
            items={sortItemsByLabel(options.styles.map((item) => ({
              value: item,
              label: translateOption("styles", item, locale)
            })), locale)}
            values={draftState.style}
            defaultLabel={t("search.notImportant")}
            onToggle={(style) => updateDraftState((current) => ({
              ...current,
              style: style === null ? [] : toggleSelection(style, current.style),
              page: 1
            }))}
          />
        </Stack>
      </SearchSection>

      <SearchSection title={t("profile.occasionsTitle")}>
        <MultiSelectChips
          items={occasionItems}
          values={draftState.occasions}
          defaultLabel={t("search.notImportant")}
          onToggle={(occasion) => updateDraftState((current) => ({
            ...current,
            occasions: occasion === null ? [] : toggleSelection(occasion, current.occasions),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.accentColorTitle")}>
        <AccentColorChips
          options={options.colors}
          selectedValues={draftState.color}
          emptyLabel={t("search.notImportant")}
          onToggle={(color) => updateDraftState((current) => ({
            ...current,
            color: color === null ? [] : toggleSelection(color, current.color),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("profile.patternTitle")}>
        <MultiSelectChips
          items={patternItems}
          values={draftState.pattern}
          defaultLabel={t("search.notImportant")}
          onToggle={(pattern) => updateDraftState((current) => ({
            ...current,
            pattern: pattern === null ? [] : toggleSelection(pattern, current.pattern),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.silhouette")}>
        <MultiSelectChips
          items={silhouetteItems}
          values={draftState.silhouette}
          defaultLabel={t("search.notImportant")}
          onToggle={(silhouette) => updateDraftState((current) => ({
            ...current,
            silhouette: silhouette === null ? [] : toggleSelection(silhouette, current.silhouette),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.fit")}>
        <MultiSelectChips
          items={fitItems}
          values={draftState.fit}
          defaultLabel={t("search.notImportant")}
          onToggle={(fit) => updateDraftState((current) => ({
            ...current,
            fit: fit === null ? [] : toggleSelection(fit, current.fit),
            page: 1
          }))}
        />
      </SearchSection>

      <SearchSection title={t("search.filters.closureType")}>
        <MultiSelectChips
          items={closureTypeItems}
          values={draftState.closureType}
          defaultLabel={t("search.notImportant")}
          onToggle={(closureType) => updateDraftState((current) => ({
            ...current,
            closureType: closureType === null ? [] : toggleSelection(closureType, current.closureType),
            page: 1
          }))}
        />
      </SearchSection>

      <Stack direction="row" spacing={1.5}>
        {showApplyButton ? (
          <Button variant="contained" onClick={onApply} disabled={status.loading}>
            {t("filters.apply")}
          </Button>
        ) : null}
        <Button variant="outlined" color="inherit" onClick={onReset} disabled={status.loading}>
          {t("filters.reset")}
        </Button>
      </Stack>
      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default SearchFiltersSidebar;
export type { SearchFiltersSidebarProps, SearchFiltersStatus, SearchStateUpdater };
