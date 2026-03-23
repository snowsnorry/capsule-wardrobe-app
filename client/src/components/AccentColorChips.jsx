import { Box, Chip, Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

const ACCENT_COLOR_SWATCHES = {
  black: "#1f2933",
  white: "#f8f5ef",
  gray: "#94a3b8",
  beige: "#d6c1a3",
  brown: "#8b5e3c",
  blue: "#4f83cc",
  green: "#4d8b55",
  red: "#c84c4c",
  pink: "#d88aa6",
  yellow: "#d9b43b",
  purple: "#8a5fbf",
  orange: "#d97a2b"
};

function AccentColorChips({
  options,
  selectedValues,
  onToggle,
  selectedValue = null,
  onSelect
}) {
  const { t, locale } = useI18n();
  const isMultiSelect = Array.isArray(selectedValues) && typeof onToggle === "function";
  const activeValues = isMultiSelect
    ? selectedValues
    : (selectedValue ? [selectedValue] : []);

  const handleToggle = (value) => {
    if (isMultiSelect) {
      onToggle(value);
      return;
    }

    if (typeof onSelect === "function") {
      onSelect(value);
    }
  };

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      <Chip
        label={t("profile.accentColorNotImportant")}
        clickable
        color={activeValues.length === 0 ? "primary" : "default"}
        onClick={() => handleToggle(null)}
      />
      {options.map((item) => (
        <Chip
          key={item}
          clickable
          color={activeValues.includes(item) ? "primary" : "default"}
          onClick={() => handleToggle(item)}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "999px",
                  bgcolor: ACCENT_COLOR_SWATCHES[item] || "transparent",
                  border: item === "white" ? "1px solid rgba(31, 41, 51, 0.24)" : "none",
                  boxSizing: "border-box"
                }}
              />
              <span>{translateOption("accentColors", item, locale)}</span>
            </Stack>
          }
        />
      ))}
    </Stack>
  );
}

export default AccentColorChips;
