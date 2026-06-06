import type { MouseEvent } from "react";
import {
  Box,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { MyWardrobeSource } from "../api/myWardrobe";
import WardrobeLikedOnlyToggle from "./WardrobeLikedOnlyToggle";
import WardrobeUploadSplitButton from "./WardrobeUploadSplitButton";

type WardrobeFilter = "all" | MyWardrobeSource;

type WardrobeToolbarProps = {
  filter: WardrobeFilter;
  isMobile: boolean;
  likedOnly: boolean;
  isLoading: boolean;
  onFilterChange: (filter: WardrobeFilter) => void;
  onLikedOnlyChange: (likedOnly: boolean) => void;
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
  isLoading,
  onOpenMenu,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: Omit<WardrobeToolbarProps, "isMobile">) {
  return (
    <Stack
      direction="row"
      spacing={1}
      data-testid="wardrobe-toolbar"
      sx={mobileToolbarSx}
    >
      <WardrobeUploadSplitButton
        disabled={isLoading}
        isMobile
        onOpenUpload={onOpenUpload}
        onOpenUrlUpload={onOpenUrlUpload}
        t={t}
      />
      <Stack direction="row" spacing={0.75} sx={mobileActionsSx}>
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
  likedOnly,
  onFilterChange,
  onLikedOnlyChange,
  onOpenMenu,
  onOpenUpload,
  onOpenUrlUpload,
  t,
}: Omit<WardrobeToolbarProps, "isMobile">) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      data-testid="wardrobe-toolbar"
      sx={desktopToolbarSx}
    >
      <Stack direction="row" spacing={1} sx={desktopFiltersSx}>
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
        <Box
          aria-hidden="true"
          data-testid="wardrobe-filter-divider"
          sx={desktopFilterDividerSx}
        />
        <WardrobeLikedOnlyToggle
          disabled={isLoading}
          likedOnly={likedOnly}
          onLikedOnlyChange={onLikedOnlyChange}
          t={t}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={toolbarActionsSx}>
        <WardrobeUploadSplitButton
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
  alignItems: "center",
  justifyContent: "flex-end",
  width: "calc(100% + 32px)",
  mx: -2,
  px: 2,
  py: 1,
  boxSizing: "border-box",
} as const;

const desktopFiltersSx = {
  alignItems: "center",
  flexShrink: 1,
  maxWidth: "100%",
  minWidth: 0,
} as const;

const desktopFilterDividerSx = {
  flex: "0 0 auto",
  width: "1px",
  height: 32,
  mx: 0.25,
  bgcolor: "divider",
  opacity: 0.85,
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

const mobileMenuButtonSx = {
  flex: "0 0 auto",
  width: 40,
  height: 40,
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
