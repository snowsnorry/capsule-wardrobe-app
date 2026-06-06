import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  ListItemIcon,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { useI18n } from "../i18n/useI18n";
import CardLayoutMenuSection from "./mainScreen/CapsuleActionMenuLayout";
import type { MobileCardColumns } from "./mainScreen/MainScreenTypes";
import type { WardrobeFilter } from "./WardrobeToolbar";

type WardrobeActionMenuProps = {
  anchorEl: HTMLElement | null;
  disabled: boolean;
  filter: WardrobeFilter;
  isOverlay: boolean;
  likedOnly: boolean;
  mobileCardColumns: MobileCardColumns;
  onClose: () => void;
  onDownloadPdf: () => void;
  onFilterChange: (filter: WardrobeFilter) => void;
  onLikedOnlyChange: (likedOnly: boolean) => void;
  onMobileCardColumnsChange: (value: MobileCardColumns) => void;
};

const SOURCE_FILTERS: WardrobeFilter[] = ["all", "uploaded", "from_catalog"];

function WardrobeActionMenu({
  anchorEl,
  disabled,
  filter,
  isOverlay,
  likedOnly,
  mobileCardColumns,
  onClose,
  onDownloadPdf,
  onFilterChange,
  onLikedOnlyChange,
  onMobileCardColumnsChange,
}: WardrobeActionMenuProps) {
  const { t } = useI18n();
  const handleDownloadPdf = () => {
    onClose();
    onDownloadPdf();
  };

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <WardrobeFilterMenuSection
        show={isOverlay}
        disabled={disabled}
        filter={filter}
        likedOnly={likedOnly}
        onFilterChange={onFilterChange}
        onLikedOnlyChange={onLikedOnlyChange}
        t={t}
      />
      <MenuItem disabled={disabled} onClick={handleDownloadPdf}>
        <ListItemIcon>
          <DownloadRoundedIcon fontSize="small" />
        </ListItemIcon>
        {t("capsule.exportPdf")}
      </MenuItem>
      <CardLayoutMenuSection
        show={isOverlay}
        disabled={disabled}
        mobileCardColumns={mobileCardColumns}
        onClose={onClose}
        onMobileCardColumnsChange={onMobileCardColumnsChange}
      />
    </Menu>
  );
}

function WardrobeFilterMenuSection({
  show,
  disabled,
  filter,
  likedOnly,
  onFilterChange,
  onLikedOnlyChange,
  t,
}: {
  disabled: boolean;
  filter: WardrobeFilter;
  likedOnly: boolean;
  onFilterChange: (filter: WardrobeFilter) => void;
  onLikedOnlyChange: (likedOnly: boolean) => void;
  show: boolean;
  t: (key: string) => string;
}) {
  if (!show) {
    return null;
  }

  return (
    <>
      <Box sx={menuSectionSx}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={sectionTitleSx}
        >
          {t("wardrobe.filterLabel")}
        </Typography>
        <RadioGroup
          value={filter}
          aria-label={t("wardrobe.filterLabel")}
          onChange={(event) => {
            onFilterChange(event.target.value as WardrobeFilter);
          }}
        >
          {SOURCE_FILTERS.map((value) => (
            <FormControlLabel
              key={value}
              value={value}
              disabled={disabled}
              control={<Radio size="small" />}
              label={t(filterKey(value))}
              sx={menuControlSx}
            />
          ))}
        </RadioGroup>
      </Box>
      <Divider />
      <Box sx={menuSectionSx}>
        <FormControlLabel
          disabled={disabled}
          control={
            <Checkbox
              size="small"
              checked={likedOnly}
              onChange={(event) => onLikedOnlyChange(event.target.checked)}
            />
          }
          label={t("wardrobe.filters.likedOnly")}
          sx={menuControlSx}
        />
      </Box>
      <Divider />
    </>
  );
}

function filterKey(filter: WardrobeFilter) {
  return filter === "all"
    ? "wardrobe.filters.all"
    : filter === "uploaded"
      ? "wardrobe.filters.uploaded"
      : "wardrobe.filters.fromCatalog";
}

const menuSectionSx = {
  px: 2,
  py: 1.25,
  display: "grid",
  gap: 0.75,
  minWidth: 240,
} as const;

const sectionTitleSx = {
  fontWeight: 700,
  textTransform: "uppercase",
} as const;

const menuControlSx = {
  m: 0,
  minHeight: 36,
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
  },
} as const;

export default WardrobeActionMenu;
