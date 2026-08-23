import { Box, Stack } from "@mui/material";
import type { ReactNode } from "react";
import type { ActiveFilterChip } from "../search/searchState";
import { PatternSwatch } from "./PatternSwatch";

function ActiveFilterChipLabel({
  chip,
}: {
  chip: ActiveFilterChip;
}): ReactNode {
  if (chip.swatchColor) {
    return (
      <Stack
        aria-label={chip.label}
        component="span"
        direction="row"
        spacing={0.75}
        sx={{ alignItems: "center" }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 14,
            height: 14,
            flex: "0 0 auto",
            border: 1,
            borderColor: "divider",
            borderRadius: "50%",
            bgcolor: chip.swatchColor,
          }}
        />
        <Box component="span">{chip.label}</Box>
      </Stack>
    );
  }

  if (chip.optionGroup !== "patterns" || !chip.values?.length) {
    return chip.label;
  }

  const labels = chip.valueLabels || chip.values;
  const valueCount = chip.values.length;

  return (
    <Stack
      aria-label={chip.label}
      component="span"
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", minWidth: 0 }}
    >
      {chip.title ? (
        <Box component="span" sx={{ flex: "0 0 auto" }}>
          {chip.title}:{" "}
        </Box>
      ) : null}
      <Stack
        component="span"
        direction="row"
        spacing={0.75}
        sx={{ alignItems: "center", minWidth: 0 }}
      >
        {chip.values.map((value, index) => (
          <Stack
            key={value}
            component="span"
            direction="row"
            spacing={0.5}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <PatternSwatch pattern={value} />
            <Box component="span">
              {labels[index] || value}
              {index < valueCount - 1 ? ", " : ""}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export { ActiveFilterChipLabel };
