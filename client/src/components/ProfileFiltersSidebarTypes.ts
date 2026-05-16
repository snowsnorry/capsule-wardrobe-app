import type AccentColorChips from "./AccentColorChips";
import type StylePreferenceSelector from "./StylePreferenceSelector";

type StyleOptions = Parameters<
  typeof StylePreferenceSelector
>[0]["styleOptions"];
type AccentColorOptions = Parameters<typeof AccentColorChips>[0]["options"];
type AccentColorValue = Parameters<
  NonNullable<Parameters<typeof AccentColorChips>[0]["onSelect"]>
>[0];
type ProfileFilterValue = string;
type CapsuleSourceMode = "catalog_only" | "wardrobe_preferred";

type ProfileFiltersStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type ProfileFiltersSidebarProps = {
  styleOptions: StyleOptions;
  occasionOptions: ProfileFilterValue[];
  seasonOptions: ProfileFilterValue[];
  audienceOptions: ProfileFilterValue[];
  accentColorOptions: AccentColorOptions;
  patternOptions: ProfileFilterValue[];
  selectedStyleCore: ProfileFilterValue | null;
  selectedStyleAesthetic: ProfileFilterValue | null;
  selectedOccasions: ProfileFilterValue[];
  selectedSeasons: ProfileFilterValue[];
  selectedAudience: ProfileFilterValue | null;
  selectedAccentColor: AccentColorValue;
  selectedPattern: ProfileFilterValue | null;
  selectedSourceMode: CapsuleSourceMode;
  selectedText: string;
  hasFilterChanges?: boolean;
  status: ProfileFiltersStatus;
  onSelectStyleCore: (value: ProfileFilterValue) => void;
  onSelectStyleAesthetic: (value: ProfileFilterValue | null) => void;
  onToggleOccasion: (value: ProfileFilterValue) => void;
  onToggleSeason: (value: ProfileFilterValue) => void;
  onSelectAudience: (value: ProfileFilterValue) => void;
  onSelectAccentColor: (value: AccentColorValue) => void;
  onSelectPattern: (value: ProfileFilterValue) => void;
  onSelectSourceMode: (value: CapsuleSourceMode) => void;
  onTextChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
  onSignOut?: () => void;
  isSigningOut?: boolean;
  isInteractionDisabled?: boolean;
  resetLabelKey?: string;
  showSettingsTitle?: boolean;
};

export type {
  CapsuleSourceMode,
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
};
