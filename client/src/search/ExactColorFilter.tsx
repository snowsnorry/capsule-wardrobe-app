import { useEffect, useState } from "react";
import {
  Box,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

const DEFAULT_EXACT_COLOR = "#808080";
const EXACT_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
type Translate = (key: string) => string;

function ColorInputAdornment({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <InputAdornment position="start" sx={{ mr: 0.25 }}>
      <Box
        sx={{
          position: "relative",
          display: "grid",
          width: 32,
          height: 44,
          placeItems: "center",
          flex: "0 0 auto",
          mr: 1.5,
          "&:focus-within [data-color-swatch]": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 1,
          },
        }}
      >
        <Box
          aria-hidden="true"
          data-color-swatch
          sx={{
            width: 32,
            height: 32,
            border: 1,
            borderColor: "action.disabled",
            borderRadius: "var(--cw-radius-card)",
            bgcolor: value,
          }}
        />
        <Box
          component="input"
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          sx={{
            position: "absolute",
            inset: "0 -6px",
            width: "auto",
            height: "auto",
            p: 0,
            border: 0,
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </Box>
      <Typography
        component="span"
        aria-hidden="true"
        sx={{
          color: "text.primary",
          fontSize: "1rem",
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        #
      </Typography>
    </InputAdornment>
  );
}

function ExactColorInput({
  value,
  draft,
  showError,
  setDraft,
  setShowError,
  commitDraft,
  t,
}: {
  value: string;
  draft: string;
  showError: boolean;
  setDraft: (value: string) => void;
  setShowError: (value: boolean) => void;
  commitDraft: (value: string) => void;
  t: Translate;
}) {
  const updateEditableValue = (editableValue: string) => {
    const nextDraft = `#${editableValue.replaceAll("#", "").slice(0, 6)}`;
    setDraft(nextDraft);
    setShowError(false);
    if (EXACT_COLOR_PATTERN.test(nextDraft)) commitDraft(nextDraft);
  };

  return (
    <TextField
      fullWidth
      value={draft.slice(1)}
      error={showError}
      helperText={showError ? t("search.filters.exactColorInvalid") : undefined}
      onChange={(event) => updateEditableValue(event.target.value)}
      onPaste={(event) => {
        event.preventDefault();
        updateEditableValue(event.clipboardData.getData("text"));
      }}
      onBlur={() => commitDraft(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft(draft);
        }
      }}
      slotProps={{
        input: {
          startAdornment: (
            <ColorInputAdornment
              value={value}
              label={t("search.filters.exactColorPicker")}
              onChange={commitDraft}
            />
          ),
        },
        htmlInput: {
          "aria-label": t("search.filters.exactColorHex"),
          maxLength: 6,
          spellCheck: false,
          autoCapitalize: "off",
          autoComplete: "off",
        },
      }}
      sx={{
        minWidth: 0,
        "& .MuiOutlinedInput-root": {
          minHeight: 48,
          py: 0,
          pl: 1,
          pr: 1.75,
          borderRadius: "var(--cw-radius-dialog)",
        },
        "& .MuiInputAdornment-root": {
          height: 44,
          maxHeight: "none",
        },
        "& .MuiInputBase-input": {
          py: 1.25,
          pl: 0,
          fontSize: "1rem",
          lineHeight: 1.5,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        },
      }}
    />
  );
}

function ExactColorFilter({
  value,
  onChange,
  t,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  t: Translate;
}) {
  const [draft, setDraft] = useState(value || DEFAULT_EXACT_COLOR);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setDraft(value || DEFAULT_EXACT_COLOR);
    setShowError(false);
  }, [value]);

  const commitDraft = (nextDraft: string) => {
    if (!EXACT_COLOR_PATTERN.test(nextDraft)) {
      setShowError(true);
      return;
    }
    const normalized = nextDraft.toLowerCase();
    setDraft(normalized);
    setShowError(false);
    onChange(normalized);
  };

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t("search.filters.exactColor")}
        </Typography>
        <Switch
          checked={Boolean(value)}
          onChange={(_event, checked) => {
            setShowError(false);
            onChange(checked ? DEFAULT_EXACT_COLOR : null);
          }}
          slotProps={{
            input: { "aria-label": t("search.filters.exactColorToggle") },
          }}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {t("search.filters.exactColorHint")}
      </Typography>
      {value ? (
        <ExactColorInput
          value={value}
          draft={draft}
          showError={showError}
          setDraft={setDraft}
          setShowError={setShowError}
          commitDraft={commitDraft}
          t={t}
        />
      ) : null}
    </Stack>
  );
}

export default ExactColorFilter;
