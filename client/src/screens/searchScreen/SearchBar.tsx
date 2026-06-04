import type { KeyboardEvent, ReactElement } from "react";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { IconButton, InputAdornment, Stack, TextField } from "@mui/material";

type SearchBarProps = {
  isMobile: boolean;
  query: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  onOpenFilters: () => void;
  onQueryChange: (query: string) => void;
  onApplyQuery: () => void;
  onClearQuery: () => void;
};

export const SEARCH_BAR_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "background.paper",
  },
} as const;

function SearchBar({
  isMobile,
  query,
  t,
  onOpenFilters,
  onQueryChange,
  onApplyQuery,
  onClearQuery,
}: SearchBarProps): ReactElement {
  return (
    <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
      {isMobile ? (
        <IconButton
          aria-label={t("filters.open")}
          onClick={onOpenFilters}
          sx={{ flexShrink: 0 }}
        >
          <TuneRoundedIcon />
        </IconButton>
      ) : null}
      <TextField
        fullWidth
        sx={SEARCH_BAR_FIELD_SX}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onBlur={onApplyQuery}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onApplyQuery();
          }
        }}
        placeholder={t("search.placeholder")}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  aria-label={t("search.clear")}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={onClearQuery}
                  size="small"
                >
                  <ClearRoundedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />
    </Stack>
  );
}

export default SearchBar;
