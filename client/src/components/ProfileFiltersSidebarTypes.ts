type ProfileFilterValue = string;
type StyleOptions = {
  core?: ProfileFilterValue[];
  aesthetics?: ProfileFilterValue[];
};
type AccentColorValue = ProfileFilterValue | null;
type AccentColorOptions = ProfileFilterValue[];
type CapsuleSourceMode =
  | "catalog_only"
  | "wardrobe_preferred"
  | "wardrobe_only";
type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

type ProfileFiltersStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type ProfileFiltersSourceModeStatus = {
  isBlocking: boolean;
  message: string;
  severity: "error" | "info" | "warning";
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
  sourceModeStatus?: ProfileFiltersSourceModeStatus | null;
  selectedText: string;
  selectedAnchorItemRefs?: AnchorItemRef[];
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
  onSelectAnchorItemRefs?: (value: AnchorItemRef[]) => void;
  onApply: () => void;
  onReset: () => void;
  onSignOut?: () => void;
  isSigningOut?: boolean;
  isInteractionDisabled?: boolean;
  resetLabelKey?: string;
  showSettingsTitle?: boolean;
  showFooterActions?: boolean;
  anchorPickerFullScreen?: boolean;
};

export type {
  CapsuleSourceMode,
  AnchorItemRef,
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
  ProfileFiltersSourceModeStatus,
};
