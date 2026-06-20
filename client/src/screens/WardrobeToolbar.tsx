import type { MouseEvent } from "react";
import {
  Button,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { PersonalItemSource } from "../api/personalItems";
import WardrobeLikedOnlyToggle from "./WardrobeLikedOnlyToggle";
import WardrobeUploadSplitButton from "./WardrobeUploadSplitButton";

type WardrobeFilter = "all" | PersonalItemSource;

type WardrobeToolbarProps = {
  canAnalyze: boolean;
  filter: WardrobeFilter;
  hasReport: boolean;
  isMobile: boolean;
  limitSurfaceEnd?: boolean;
  likedOnly: boolean;
  isLoading: boolean;
  onAnalyze: () => void;
  onFilterChange: (filter: WardrobeFilter) => void;
  onLikedOnlyChange: (likedOnly: boolean) => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenUpload: () => void;
  onOpenUrlUpload: () => void;
  t: (key: string) => string;
};

const FILTERS: WardrobeFilter[] = ["all", "uploaded", "from_catalog"];

function getSourceFilter(filter: WardrobeFilter): PersonalItemSource | null {
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
  canAnalyze,
  filter,
  hasReport,
  isLoading,
  limitSurfaceEnd = false,
  likedOnly,
  onAnalyze,
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
      sx={getDesktopToolbarSx(limitSurfaceEnd)}
    >
      <Stack direction="row" spacing={1} sx={desktopFiltersSx}>
        <ToggleButtonGroup
          exclusive
          size="small"
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
        <WardrobeLikedOnlyToggle
          disabled={isLoading}
          likedOnly={likedOnly}
          onLikedOnlyChange={onLikedOnlyChange}
          t={t}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={toolbarActionsSx}>
        {!hasReport ? (
          <Button
            variant="outlined"
            disabled={isLoading || !canAnalyze}
            onClick={onAnalyze}
          >
            {t("wardrobe.analyzePersonalItems")}
          </Button>
        ) : null}
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

function getDesktopToolbarSx(limitSurfaceEnd: boolean) {
  if (!limitSurfaceEnd) {
    return desktopToolbarSx;
  }

  return {
    ...desktopToolbarSx,
    clipPath: "inset(-100vmax 0 0 -100vmax)",
    "&::after": {
      ...desktopToolbarSx["&::after"],
      right: 0,
    },
  } as const;
}

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
  width: "var(--cw-control-action-height)",
  height: "var(--cw-control-action-height)",
} as const;

const filterGroupSx = {
  flexShrink: 1,
  maxWidth: "100%",
  overflowX: "auto",
  "& .MuiToggleButton-root": {
    minWidth: 44,
    fontSize: 14,
    px: 1.25,
    textTransform: "none",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
} as const;

export default WardrobeToolbar;
export { getSourceFilter };
export type { WardrobeFilter };
