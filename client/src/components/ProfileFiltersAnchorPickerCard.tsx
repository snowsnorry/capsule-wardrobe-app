import { Box, ButtonBase, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
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

export default AnchorPickerCard;
