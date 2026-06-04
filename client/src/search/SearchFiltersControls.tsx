import { Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { toggleSelection } from "./searchState";
import type { SearchDraftState } from "./searchState";
import type { SelectItem } from "./SearchFiltersSidebarTypes";

function SearchSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
      {children}
    </Stack>
  );
}

function MultiSelectChips({
  items,
  values,
  onToggle,
  defaultLabel,
  defaultPosition = "start",
}: {
  items: SelectItem[];
  values: string[];
  onToggle: (value: string | null) => void;
  defaultLabel?: string;
  defaultPosition?: "start" | "end";
}) {
  const defaultChip = defaultLabel ? (
    <Chip
      label={defaultLabel}
      clickable
      color={values.length === 0 ? "primary" : "default"}
      onClick={() => onToggle(null)}
    />
  ) : null;

  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
      {defaultPosition === "start" ? defaultChip : null}
      {items.map((item) => (
        <Chip
          key={item.value}
          label={item.label}
          clickable
          color={values.includes(item.value) ? "primary" : "default"}
          onClick={() => onToggle(item.value)}
        />
      ))}
      {defaultPosition === "end" ? defaultChip : null}
    </Stack>
  );
}

function updateMultiValue(field: keyof SearchDraftState, value: string | null) {
  return (current: SearchDraftState) => ({
    ...current,
    [field]:
      value === null ? [] : toggleSelection(value, current[field] as string[]),
    page: 1,
  });
}

export { MultiSelectChips, SearchSection, updateMultiValue };
