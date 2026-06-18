import {
  Alert,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useId } from "react";
import type {
  CapsuleSourceMode,
  ProfileFiltersSidebarProps,
} from "./ProfileFiltersSidebarTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

const sourceModeOptions = [
  {
    labelKey: "capsule.sourceMode.catalogOnly",
    value: "catalog_only",
  },
  {
    labelKey: "capsule.sourceMode.wardrobePreferred",
    value: "wardrobe_preferred",
  },
  {
    labelKey: "capsule.sourceMode.wardrobeOnly",
    value: "wardrobe_only",
  },
] as const;

const sourceModeAlertSx = {
  alignItems: "flex-start",
  borderRadius: "var(--cw-radius-card)",
  py: 0.5,
  "& .MuiAlert-message": {
    fontSize: "0.8125rem",
    lineHeight: 1.35,
  },
} as const;

const sourceModeControlLabelSx = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  lineHeight: 1.25,
  mb: 0.75,
  px: 0.25,
} as const;

const sourceModeItemSx = {
  minHeight: "auto",
  py: 1,
  whiteSpace: "normal",
  wordBreak: "break-word",
} as const;

const sourceModeSelectedLabelSx = {
  fontWeight: 600,
  lineHeight: 1.3,
  whiteSpace: "normal",
  wordBreak: "break-word",
} as const;

const sourceModeSelectSx = {
  bgcolor: "action.hover",
  borderRadius: "var(--cw-radius-card)",
  height: 40,
  "&& .MuiSelect-select": {
    alignItems: "center",
    color: "text.primary",
    display: "flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.3,
    minHeight: "unset",
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
} as const;

function SourceModeSelect({
  disabled,
  props,
  t,
}: {
  disabled: boolean;
  props: ProfileFiltersSidebarProps;
  t: Translate;
}) {
  const id = useId();
  const labelId = `${id}-capsule-source-mode-label`;
  const selectId = `${id}-capsule-source-mode`;

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <SourceModeSelectControl
        disabled={disabled}
        labelId={labelId}
        selectId={selectId}
        selectedSourceMode={props.selectedSourceMode}
        onSelectSourceMode={props.onSelectSourceMode}
        t={t}
      />
      <SourceModeStatusAlert status={props.sourceModeStatus} />
    </Stack>
  );
}

function SourceModeSelectControl({
  disabled,
  labelId,
  onSelectSourceMode,
  selectId,
  selectedSourceMode,
  t,
}: {
  disabled: boolean;
  labelId: string;
  onSelectSourceMode: (value: CapsuleSourceMode) => void;
  selectId: string;
  selectedSourceMode: CapsuleSourceMode;
  t: Translate;
}) {
  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    if (isSourceMode(value)) {
      onSelectSourceMode(value);
    }
  };

  return (
    <FormControl fullWidth disabled={disabled} size="small">
      <Typography
        id={labelId}
        variant="caption"
        sx={{
          ...sourceModeControlLabelSx,
          color: disabled ? "text.disabled" : "text.secondary",
        }}
      >
        {t("capsule.sourceMode.label")}
      </Typography>
      <Select
        id={selectId}
        labelId={labelId}
        value={selectedSourceMode}
        onChange={handleChange}
        renderValue={(value) => <SourceModeSelectedLabel value={value} t={t} />}
        MenuProps={{ slotProps: { paper: { sx: { maxWidth: 300 } } } }}
        sx={sourceModeSelectSx}
      >
        {sourceModeOptions.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            sx={sourceModeItemSx}
          >
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SourceModeSelectedLabel({
  value,
  t,
}: {
  value: string;
  t: Translate;
}) {
  return (
    <Typography component="span" variant="body2" sx={sourceModeSelectedLabelSx}>
      {getSourceModeLabel(value, t)}
    </Typography>
  );
}

function SourceModeStatusAlert({
  status,
}: {
  status: ProfileFiltersSidebarProps["sourceModeStatus"];
}) {
  if (!status) {
    return null;
  }

  return (
    <Alert severity={status.severity} variant="outlined" sx={sourceModeAlertSx}>
      {status.message}
    </Alert>
  );
}

function isSourceMode(value: string): value is CapsuleSourceMode {
  return sourceModeOptions.some((option) => option.value === value);
}

function getSourceModeLabel(value: string, t: Translate) {
  const option = sourceModeOptions.find((item) => item.value === value);
  return t(option?.labelKey || "capsule.sourceMode.catalogOnly");
}

export { SourceModeSelect };
