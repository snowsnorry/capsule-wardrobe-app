import { Box, Chip, Stack } from "@mui/material";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { getColorSwatchStyle } from "../../../shared/colorSwatches.js";

type AccentColorValue = string;

type AccentColorChipsProps = {
  options: AccentColorValue[];
  selectedValues?: AccentColorValue[];
  onToggle?: (value: AccentColorValue | null) => void;
  selectedValue?: AccentColorValue | null;
  onSelect?: (value: AccentColorValue | null) => void;
  emptyLabel?: string;
  disabled?: boolean;
};

function AccentColorChips({
  options,
  selectedValues,
  onToggle,
  selectedValue = null,
  onSelect,
  emptyLabel,
  disabled = false,
}: AccentColorChipsProps) {
  const { t, locale } = useI18n();
  const isMultiSelect =
    Array.isArray(selectedValues) && typeof onToggle === "function";
  const activeValues = isMultiSelect
    ? selectedValues
    : selectedValue
      ? [selectedValue]
      : [];
  const emptyChipLabel = emptyLabel || t("profile.accentColorNotImportant");

  const handleToggle = (value: AccentColorValue | null) => {
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
        label={emptyChipLabel}
        clickable
        disabled={disabled}
        color={activeValues.length === 0 ? "primary" : "default"}
        onClick={() => handleToggle(null)}
      />
      {options.map((item) => (
        <Chip
          key={item}
          clickable
          disabled={disabled}
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
                  ...getColorSwatchStyle(item),
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
