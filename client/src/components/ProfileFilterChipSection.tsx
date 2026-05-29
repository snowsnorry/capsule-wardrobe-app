import { Chip, Stack } from "@mui/material";
import { translateOption } from "../i18n";
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
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {options.map((item) => (
          <Chip
            key={item}
            label={translateOption(optionGroup, item, locale)}
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

export { ProfileFilterChipSection };
