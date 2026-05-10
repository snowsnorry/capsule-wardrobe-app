import {
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
} from "@mui/material";
import type { ReactNode } from "react";

const SETTINGS_FIELD_IDS = {
  email: "settings-email",
  fullname: "settings-fullname",
  imageLlm: "settings-image-llm",
  imageLlmLabel: "settings-image-llm-label",
  language: "settings-language",
  languageLabel: "settings-language-label",
  stylistModel: "settings-stylist-model",
  stylistModelLabel: "settings-stylist-model-label",
  theme: "settings-theme",
  themeLabel: "settings-theme-label",
} as const;

function SettingsSelectField({
  id,
  labelId,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  labelId: string;
  label: string;
  value: string;
  onChange: (event: SelectChangeEvent<string>) => void;
  children: ReactNode;
}) {
  return (
    <FormControl>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        id={id}
        labelId={labelId}
        label={label}
        value={value}
        onChange={onChange}
      >
        {children}
      </Select>
    </FormControl>
  );
}

export { SETTINGS_FIELD_IDS, SettingsSelectField };
