import { Box, ButtonBase, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { AnchorImage } from "./ProfileFiltersAnchorImage";
import {
  getAnchorCategoryLabel,
  getAnchorLabel,
} from "./ProfileFiltersAnchorUtils";
import type { AnchorItem, Translate } from "./ProfileFiltersAnchorTypes";
import { pickerCardSx } from "./ProfileFiltersAnchorStyles";

function AnchorPickerCard({
  item,
  locale,
  onToggle,
  selected,
  selectionFull,
  t,
}: {
  item: AnchorItem;
  locale: string;
  onToggle: (id: string) => void;
  selected: boolean;
  selectionFull: boolean;
  t: Translate;
}) {
  const disabled = !selected && selectionFull;
  const label = getAnchorLabel(item, item.id, t);
  const likedLabel = t("wardrobe.likedBadge");

  return (
    <ButtonBase
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => onToggle(item.id)}
      sx={(theme) => pickerCardSx(theme, selected, disabled)}
    >
      <AnchorImage item={item} label={label} large />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {item.isLiked ? <AnchorLikedTitleIcon label={likedLabel} /> : null}
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {getAnchorCategoryLabel(item.category, locale)}
        </Typography>
      </Box>
      {selected ? (
        <CheckCircleRoundedIcon color="primary" fontSize="small" />
      ) : null}
    </ButtonBase>
  );
}

function AnchorLikedTitleIcon({ label }: { label: string }) {
  return (
    <FavoriteRoundedIcon
      titleAccess={label}
      aria-label={label}
      sx={{
        color: "var(--cw-color-liked-indicator, #c62828)",
        display: "inline-block",
        fontSize: 16,
        mr: 0.45,
        verticalAlign: "-0.16em",
      }}
    />
  );
}

export default AnchorPickerCard;
