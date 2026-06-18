import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useId } from "react";
import type { ReactNode } from "react";
import { translateOption } from "../i18n";
import type { ProfileFilterValue } from "./ProfileFiltersSidebarTypes";

type SelectOption = {
  label: string;
  value: ProfileFilterValue;
};

type EmptyOption = {
  label: string;
  value: "";
};

type ProfileFilterSelectSectionProps = {
  title: string;
  hint: string;
  options: ProfileFilterValue[];
  selectedValue: ProfileFilterValue | null;
  optionGroup: "styles" | "patterns" | "accentColors";
  locale: string;
  disabled: boolean;
  onSelect: (value: ProfileFilterValue | null) => void;
  emptyOption?: EmptyOption;
  renderPrefix?: (value: ProfileFilterValue) => ReactNode;
};

const filterSelectItemSx = {
  minHeight: "auto",
  py: 1,
} as const;

const filterSelectLabelSx = {
  alignItems: "center",
  display: "flex",
  gap: 1,
  minWidth: 0,
} as const;

const filterSelectSx = {
  bgcolor: "action.hover",
  borderRadius: "var(--cw-radius-card)",
  height: 40,
  "&& .MuiSelect-select": {
    alignItems: "center",
    display: "flex",
    fontSize: "0.875rem",
    lineHeight: 1.3,
    minHeight: "unset",
  },
} as const;

function ProfileFilterSelectSection({
  title,
  hint,
  options,
  selectedValue,
  optionGroup,
  locale,
  disabled,
  onSelect,
  emptyOption,
  renderPrefix,
}: ProfileFilterSelectSectionProps) {
  const id = useId();
  const labelId = `${id}-filter-label`;
  const selectId = `${id}-filter-select`;
  const resolvedValue = selectedValue ?? "";
  const selectOptions: Array<SelectOption | EmptyOption> = [
    ...(emptyOption ? [emptyOption] : []),
    ...options.map((value) => ({
      value,
      label: translateOption(optionGroup, value, locale),
    })),
  ];

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    onSelect(value === "" ? null : value);
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography id={labelId} variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {hint ? (
          <Typography variant="body2" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </Stack>
      <FormControl fullWidth disabled={disabled} size="small">
        <Select
          id={selectId}
          labelId={labelId}
          value={resolvedValue}
          displayEmpty
          onChange={handleChange}
          renderValue={(value) => (
            <FilterSelectValue
              isControlValue
              options={selectOptions}
              value={value}
              renderPrefix={renderPrefix}
            />
          )}
          MenuProps={{ slotProps: { paper: { sx: { maxWidth: 300 } } } }}
          sx={filterSelectSx}
        >
          {selectOptions.map((option) => (
            <MenuItem
              key={option.value || "__empty"}
              value={option.value}
              sx={filterSelectItemSx}
            >
              <FilterSelectValue
                options={selectOptions}
                value={option.value}
                renderPrefix={renderPrefix}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

function FilterSelectValue({
  isControlValue = false,
  options,
  value,
  renderPrefix,
}: {
  isControlValue?: boolean;
  options: Array<SelectOption | EmptyOption>;
  value: string;
  renderPrefix?: (value: ProfileFilterValue) => ReactNode;
}) {
  const selected = options.find((option) => option.value === value);
  const prefix = value ? renderPrefix?.(value) : null;

  return (
    <Typography
      component="span"
      variant="body2"
      sx={{
        ...filterSelectLabelSx,
        fontWeight: isControlValue ? 600 : undefined,
      }}
    >
      {prefix}
      <Box
        component="span"
        sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {selected?.label || ""}
      </Box>
    </Typography>
  );
}

export { ProfileFilterSelectSection };
