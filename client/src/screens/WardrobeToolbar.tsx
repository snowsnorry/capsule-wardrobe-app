import { useState } from "react";
import type { MouseEvent } from "react";
import {
  Button,
  ButtonGroup,
  FormControl,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from "@mui/material";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { MyWardrobeSource } from "../api/myWardrobe";

type WardrobeFilter = "all" | MyWardrobeSource;

type WardrobeToolbarProps = {
  filter: WardrobeFilter;
  isMobile: boolean;
  isLoading: boolean;
  onFilterChange: (filter: WardrobeFilter) => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenUpload: () => void;
  onOpenUrlUpload: () => void;
  t: (key: string) => string;
};

const FILTERS: WardrobeFilter[] = ["all", "uploaded", "from_catalog"];

function getSourceFilter(filter: WardrobeFilter): MyWardrobeSource | null {
  return filter === "all" ? null : filter;
}

function filterKey(filter: WardrobeFilter) {
  return filter === "all"
    ? "wardrobe.filters.all"
    : filter === "uploaded"
      ? "wardrobe.filters.uploaded"
      : "wardrobe.filters.fromCatalog";
}

function WardrobeMobileToolbar({
  filter,
  isLoading,
  onFilterChange,
  onOpenMenu,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: Omit<WardrobeToolbarProps, "isMobile">) {
  return (
    <Stack direction="row" spacing={1} sx={mobileToolbarSx}>
      <FormControl size="small" sx={mobileFilterControlSx}>
        <Select
          value={filter}
          onChange={(event: SelectChangeEvent<WardrobeFilter>) => {
            onFilterChange(event.target.value as WardrobeFilter);
          }}
          disabled={isLoading}
          displayEmpty
          inputProps={{ "aria-label": t("wardrobe.filterLabel") }}
          sx={mobileFilterSelectSx}
        >
          {FILTERS.map((value) => (
            <MenuItem key={value} value={value}>
              {t(filterKey(value))}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Stack direction="row" spacing={0.75} sx={mobileActionsSx}>
        <UploadSplitButton
          disabled={isLoading}
          isMobile
          onOpenUpload={onOpenUpload}
          onOpenUrlUpload={onOpenUrlUpload}
          t={t}
        />
        <IconButton
          aria-label={t("wardrobe.openMenu")}
          disabled={isLoading}
          onClick={onOpenMenu}
          sx={mobileMenuButtonSx}
        >
          <MoreVertRoundedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function WardrobeDesktopToolbar({
  filter,
  isLoading,
  onFilterChange,
  onOpenMenu,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: Omit<WardrobeToolbarProps, "isMobile">) {
  return (
    <Stack direction="row" spacing={1.5} sx={desktopToolbarSx}>
      <ToggleButtonGroup
        exclusive
        value={filter}
        onChange={(_event, value: WardrobeFilter | null) => {
          if (value) {
            onFilterChange(value);
          }
        }}
        aria-label={t("wardrobe.filterLabel")}
        sx={filterGroupSx}
      >
        {FILTERS.map((value) => (
          <ToggleButton
            key={value}
            value={value}
            disabled={isLoading}
            aria-label={t(filterKey(value))}
          >
            {t(filterKey(value))}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack direction="row" spacing={1} sx={toolbarActionsSx}>
        <UploadSplitButton
          disabled={isLoading}
          onOpenUpload={onOpenUpload}
          onOpenUrlUpload={onOpenUrlUpload}
          t={t}
        />
        <IconButton
          aria-label={t("wardrobe.openMenu")}
          disabled={isLoading}
          onClick={onOpenMenu}
        >
          <MoreVertRoundedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function UploadSplitButton({
  disabled,
  isMobile = false,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: {
  disabled: boolean;
  isMobile?: boolean;
  onOpenUpload: () => void;
  onOpenUrlUpload: () => void;
  t: (key: string) => string;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorEl);

  const closeMenu = () => setAnchorEl(null);
  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const selectPhotoUpload = () => {
    closeMenu();
    onOpenUpload();
  };
  const selectUrlUpload = () => {
    closeMenu();
    onOpenUrlUpload();
  };

  return (
    <>
      <ButtonGroup
        variant="outlined"
        disabled={disabled}
        sx={isMobile ? mobileUploadButtonGroupSx : uploadButtonGroupSx}
      >
        <Button
          startIcon={<FileUploadOutlinedIcon />}
          aria-label={t("wardrobe.upload")}
          onClick={onOpenUpload}
          sx={isMobile ? mobileUploadMainButtonSx : uploadMainButtonSx}
        >
          {t("wardrobe.uploadDialog.upload")}
        </Button>
        <Button
          aria-label={t("wardrobe.uploadMenu")}
          aria-controls={isMenuOpen ? "wardrobe-upload-menu" : undefined}
          aria-expanded={isMenuOpen ? "true" : undefined}
          aria-haspopup="menu"
          onClick={openMenu}
          sx={uploadMenuButtonSx}
        >
          <ArrowDropDownRoundedIcon />
        </Button>
      </ButtonGroup>
      <Menu
        id="wardrobe-upload-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={closeMenu}
        slotProps={{
          list: {
            "aria-label": t("wardrobe.uploadMenuLabel"),
            dense: true,
          },
        }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <MenuItem onClick={selectPhotoUpload}>
          <ListItemIcon>
            <FileUploadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("wardrobe.uploadPhoto")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={selectUrlUpload}>
          <ListItemIcon>
            <LinkRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("wardrobe.uploadUrl")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

function WardrobeToolbar(props: WardrobeToolbarProps) {
  return props.isMobile ? (
    <WardrobeMobileToolbar {...props} />
  ) : (
    <WardrobeDesktopToolbar {...props} />
  );
}

const toolbarSurfaceSx = {
  position: "sticky",
  top: 0,
  zIndex: (theme) => theme.zIndex.appBar,
  alignItems: "center",
  bgcolor: "background.default",
  boxShadow: (theme) => `0 0 0 100vmax ${theme.palette.background.default}`,
  clipPath: "inset(-100vmax -100vmax 0)",
  "&::after": {
    content: '""',
    position: "absolute",
    right: "-100vmax",
    bottom: 0,
    left: "-100vmax",
    borderBottom: "1px solid",
    borderColor: "divider",
    pointerEvents: "none",
  },
} as const;

const desktopToolbarSx = {
  ...toolbarSurfaceSx,
  justifyContent: "space-between",
  flexWrap: "wrap",
  py: 1.5,
} as const;

const mobileToolbarSx = {
  ...toolbarSurfaceSx,
  width: "calc(100% + 32px)",
  mx: -2,
  px: 2,
  py: 1,
  boxSizing: "border-box",
} as const;

const mobileActionsSx = {
  alignItems: "center",
  justifyContent: "flex-end",
  flex: "0 0 auto",
  minWidth: 0,
} as const;

const toolbarActionsSx = {
  alignItems: "center",
  flexShrink: 0,
} as const;

const uploadButtonGroupSx = {
  flexShrink: 0,
} as const;

const mobileUploadButtonGroupSx = {
  ...uploadButtonGroupSx,
  flex: "0 1 auto",
  minWidth: 0,
} as const;

const uploadMainButtonSx = {
  whiteSpace: "nowrap",
  "& .MuiButton-startIcon": {
    mr: 0.75,
  },
} as const;

const mobileUploadMainButtonSx = {
  ...uploadMainButtonSx,
  minWidth: 0,
  px: 1.5,
} as const;

const uploadMenuButtonSx = {
  minWidth: 40,
  px: 0.5,
} as const;

const mobileMenuButtonSx = {
  flex: "0 0 auto",
  width: 40,
  height: 40,
} as const;

const mobileFilterControlSx = {
  flex: "1 1 auto",
  minWidth: 0,
} as const;

const mobileFilterSelectSx = {
  borderRadius: "var(--cw-radius-pill)",
  bgcolor: "background.paper",
  fontWeight: 700,
  "& .MuiSelect-select": {
    py: 0.85,
    pl: 1.5,
    pr: 3.5,
  },
} as const;

const filterGroupSx = {
  flexShrink: 1,
  maxWidth: "100%",
  overflowX: "auto",
  "& .MuiToggleButton-root": {
    px: 1.5,
    py: 0.65,
    borderRadius: "var(--cw-radius-pill)",
    textTransform: "none",
    fontWeight: 700,
    whiteSpace: "nowrap",
    "&.Mui-selected": {
      bgcolor: "primary.main",
      color: "primary.contrastText",
      "&:hover": {
        bgcolor: "primary.dark",
      },
    },
  },
  "& .MuiToggleButtonGroup-grouped": {
    border: "1px solid",
    borderColor: "divider",
    mx: 0.25,
  },
} as const;

export default WardrobeToolbar;
export { getSourceFilter };
export type { WardrobeFilter };
