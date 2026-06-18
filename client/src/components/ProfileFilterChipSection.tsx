import { Chip, Stack } from "@mui/material";
import { translateOption } from "../i18n";
import { PatternSwatch } from "./PatternSwatch";
import { FilterSectionTitle } from "./ProfileFilterSectionTitle";
import type { ProfileFilterValue } from "./ProfileFiltersSidebarTypes";

function ProfileFilterChipSection({
  title,
  hint,
  options,
  selectedValues,
  selectedValue,
  optionGroup,
  locale,
  disabled,
  onSelect,
}: {
  title: string;
  hint: string;
  options: ProfileFilterValue[];
  selectedValues?: ProfileFilterValue[];
  selectedValue?: ProfileFilterValue | null;
  optionGroup: "occasions" | "seasons" | "audience" | "patterns";
  locale: string;
  disabled: boolean;
  onSelect: (value: ProfileFilterValue) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <FilterSectionTitle title={title} hint={hint} />
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {options.map((item) => (
          <Chip
            key={item}
            label={
              optionGroup === "patterns" ? (
                <PatternChipLabel
                  label={translateOption(optionGroup, item, locale)}
                  value={item}
                />
              ) : (
                translateOption(optionGroup, item, locale)
              )
            }
            clickable
            disabled={disabled}
            color={
              selectedValues?.includes(item) || selectedValue === item
                ? "primary"
                : "default"
            }
            onClick={() => onSelect(item)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function PatternChipLabel({
  label,
  value,
}: {
  label: string;
  value: ProfileFilterValue;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <PatternSwatch pattern={value} />
      <span>{label}</span>
    </Stack>
  );
}

export { ProfileFilterChipSection };
