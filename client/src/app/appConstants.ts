import { ACCENT_COLOR_OPTIONS } from "../../../shared/accentColors.js";
import type {
  NotificationPromptState,
  PasskeyPromptState,
  StatusState,
} from "./appTypes";

export const initialStatus: StatusState = {
  loading: false,
  error: "",
  infoKey: "",
  infoParams: null,
};

export const initialNotificationPrompt: NotificationPromptState = {
  open: false,
};

export const initialPasskeyPrompt: PasskeyPromptState = {
  open: false,
  loading: false,
};

export const PASSKEY_PROMPT_DISMISSED_STORAGE_KEY =
  "capsule.passkeyPromptDismissed";

export const FALLBACK_STYLE_OPTIONS = {
  core: ["casual", "smart_casual", "formal"],
  aesthetics: [
    "minimalistic",
    "street_style",
    "romantic",
    "preppy",
    "retro",
    "boho",
    "nautical",
    "safari",
    "equestrian",
    "military",
    "grunge",
    "sporty",
  ],
};

export const FALLBACK_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "everyday_errands",
];

export const FALLBACK_SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];

export const FALLBACK_AUDIENCE_OPTIONS = ["man", "woman", "any"];
export const FALLBACK_ACCENT_COLOR_OPTIONS = ACCENT_COLOR_OPTIONS;
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];
