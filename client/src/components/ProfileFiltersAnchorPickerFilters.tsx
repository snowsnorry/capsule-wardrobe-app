import {
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { translateOption } from "../i18n";
import type {
  AnchorSourceFilter,
  AnchorTypeFilter,
  Translate,
} from "./ProfileFiltersAnchorTypes";

function AnchorPickerFilters({
  likedOnly,
  locale,
  onLikedOnlyChange,
  onSourceChange,
  onTypeChange,
  sourceFilter,
  t,
  typeFilter,
  typeOptions,
}: {
  likedOnly: boolean;
  locale: string;
  onLikedOnlyChange: (value: boolean) => void;
  onSourceChange: (value: AnchorSourceFilter) => void;
  onTypeChange: (value: AnchorTypeFilter) => void;
  sourceFilter: AnchorSourceFilter;
  t: Translate;
  typeFilter: AnchorTypeFilter;
  typeOptions: string[];
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={anchorSourceFilterRowSx}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={sourceFilter}
          aria-label={t("capsule.sourceMode.label")}
          onChange={(_event, value: AnchorSourceFilter | null) => {
            if (value) {
              onSourceChange(value);
            }
          }}
          sx={anchorSourceToggleGroupSx}
        >
          {(["all", "uploaded", "catalog"] as AnchorSourceFilter[]).map(
            (source) => (
              <ToggleButton
                key={source}
                value={source}
                aria-label={t(`capsule.anchors.sources.${source}`)}
              >
                {t(`capsule.anchors.sources.${source}`)}
              </ToggleButton>
            ),
          )}
        </ToggleButtonGroup>
        <ToggleButton
          value="liked-only"
          selected={likedOnly}
          aria-label={t("capsule.anchors.likedOnly")}
          onChange={() => onLikedOnlyChange(!likedOnly)}
          sx={anchorLikedChipSx}
        >
          {likedOnly ? (
            <FavoriteRoundedIcon fontSize="small" />
          ) : (
            <FavoriteBorderRoundedIcon fontSize="small" />
          )}
          {t("capsule.anchors.likedOnly")}
        </ToggleButton>
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {t("capsule.anchors.type")}
        </Typography>
        <Select
          size="small"
          value={typeFilter}
          onChange={(event) =>
            onTypeChange(event.target.value as AnchorTypeFilter)
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">{t("capsule.anchors.typesAll")}</MenuItem>
          {typeOptions.map((category) => (
            <MenuItem key={category} value={category}>
              {translateOption("categories", category, locale)}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Stack>
  );
}

const anchorSourceFilterRowSx = {
  alignItems: "center",
  flexWrap: "nowrap",
  gap: 1,
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "auto",
} as const;

const anchorSourceToggleGroupSx = {
  flexShrink: 0,
  "& .MuiToggleButton-root": {
    minWidth: 44,
    fontSize: 14,
    px: 1.25,
    textTransform: "none",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
} as const;

const anchorLikedChipSx = {
  flexShrink: 0,
  gap: 0.75,
  px: 1.5,
  py: 0.65,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "var(--cw-radius-pill)",
  textTransform: "none",
  fontWeight: 700,
  whiteSpace: "nowrap",
  "&.Mui-selected": {
    borderColor: "var(--cw-color-liked-indicator, #c62828)",
    bgcolor: "var(--cw-color-liked-indicator-bg, #fffdf9)",
    color: "var(--cw-color-liked-indicator, #c62828)",
    "&:hover": {
      bgcolor: "var(--cw-color-liked-indicator-bg, #fffdf9)",
    },
  },
} as const;

export default AnchorPickerFilters;
