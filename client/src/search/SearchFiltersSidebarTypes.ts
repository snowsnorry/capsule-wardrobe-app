import type { ChangeEvent, KeyboardEvent } from "react";
import type { SearchDraftState, SearchOptions } from "./searchState";

type SearchFiltersStatus = {
  loading: boolean;
  error: string;
};

type SearchStateUpdater =
  SearchDraftState | ((current: SearchDraftState) => SearchDraftState);

type SearchFiltersSidebarProps = {
  options: SearchOptions;
  draftState: SearchDraftState;
  onDraftStateChange: (
    updater: SearchStateUpdater,
    options?: { submit?: boolean },
  ) => void | Promise<void>;
  status: SearchFiltersStatus;
  onApply: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  autoApply?: boolean;
  showApplyButton?: boolean;
  showFooterActions?: boolean;
  showExactColorFilter?: boolean;
};

type SelectItem = {
  value: string;
  label: string;
};

type SearchFilterItems = {
  brandItems: SelectItem[];
  categoryItems: SelectItem[];
  seasonItems: SelectItem[];
  audienceItems: SelectItem[];
  occasionItems: SelectItem[];
  patternItems: SelectItem[];
  silhouetteItems: SelectItem[];
  fitItems: SelectItem[];
  closureTypeItems: SelectItem[];
};

type PriceControls = {
  sliderMin: number;
  sliderMax: number;
  priceRange: number[];
  handlePriceSliderChange: (
    _event: Event,
    nextValue: number | number[],
  ) => void;
  handlePriceSliderCommit: (
    _event: Event | React.SyntheticEvent<Element, Event>,
    nextValue: number | number[],
  ) => void;
  handlePriceInputChange: (
    field: "priceMinDraft" | "priceMaxDraft",
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
  handlePriceInputBlur: (
    field: "priceMinDraft" | "priceMaxDraft",
  ) => () => void;
  handlePriceInputKeyDown: (
    field: "priceMinDraft" | "priceMaxDraft",
  ) => (event: KeyboardEvent<HTMLInputElement>) => void;
};

type UpdateDraftState = (
  updater: SearchStateUpdater,
  options?: { submit?: boolean },
) => void;

export type {
  PriceControls,
  SearchFilterItems,
  SearchFiltersSidebarProps,
  SearchStateUpdater,
  SelectItem,
  UpdateDraftState,
};
