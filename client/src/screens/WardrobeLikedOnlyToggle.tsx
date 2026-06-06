import { ToggleButton, type SxProps, type Theme } from "@mui/material";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";

type WardrobeLikedOnlyToggleProps = {
  disabled: boolean;
  isMobile?: boolean;
  likedOnly: boolean;
  onLikedOnlyChange: (likedOnly: boolean) => void;
  t: (key: string) => string;
};

function WardrobeLikedOnlyToggle({
  disabled,
  isMobile = false,
  likedOnly,
  onLikedOnlyChange,
  t,
}: WardrobeLikedOnlyToggleProps) {
  const label = t("wardrobe.filters.likedOnly");

  return (
    <ToggleButton
      value="liked-only"
      selected={likedOnly}
      disabled={disabled}
      aria-label={label}
      onChange={() => onLikedOnlyChange(!likedOnly)}
      sx={isMobile ? mobileLikedOnlyButtonSx : likedOnlyButtonSx}
    >
      {likedOnly ? (
        <FavoriteRoundedIcon fontSize="small" />
      ) : (
        <FavoriteBorderRoundedIcon fontSize="small" />
      )}
      {label}
    </ToggleButton>
  );
}

const likedOnlyButtonSx = {
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
} satisfies SxProps<Theme>;

const mobileLikedOnlyButtonSx = {
  ...likedOnlyButtonSx,
  alignSelf: "flex-start",
  py: 0.45,
} satisfies SxProps<Theme>;

export default WardrobeLikedOnlyToggle;
