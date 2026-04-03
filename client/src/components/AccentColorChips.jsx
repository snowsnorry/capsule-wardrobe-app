import { Box, Chip, Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

const ACCENT_COLOR_SWATCH_STYLES = {
  black: { bgcolor: "#1f2933" },
  white: { bgcolor: "#f8f5ef" },
  grey: { bgcolor: "#94a3b8" },
  beige: { bgcolor: "#d6c1a3" },
  brown: { bgcolor: "#8b5e3c" },
  blue: { bgcolor: "#4f83cc" },
  navy: { bgcolor: "#243b6b" },
  green: { bgcolor: "#4d8b55" },
  khaki: { bgcolor: "#8a7f45" },
  red: { bgcolor: "#c84c4c" },
  burgundy: { bgcolor: "#7a1f3d" },
  pink: { bgcolor: "#d88aa6" },
  yellow: { bgcolor: "#d9b43b" },
  purple: { bgcolor: "#8a5fbf" },
  orange: { bgcolor: "#d97a2b" },
  denim: { bgcolor: "#5a78a8" },
  metallic: {
    background: "linear-gradient(135deg, #f3f4f6 0%, #cbd5e1 35%, #94a3b8 55%, #e5e7eb 100%)"
  },
  multicolor: {
    background: "linear-gradient(135deg, #ff6b6b 0%, #ffd166 25%, #06d6a0 50%, #4f83cc 75%, #b5179e 100%)"
  }
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
                  boxSizing: "border-box",
                  border: "1px solid #999",
                  ...ACCENT_COLOR_SWATCH_STYLES[item]
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
