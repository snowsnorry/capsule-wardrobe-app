import type { MouseEvent } from "react";
import {
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  type SelectChangeEvent,
} from "@mui/material";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { MyWardrobeSource } from "../api/myWardrobe";

type MyWardrobeFilter = "all" | MyWardrobeSource;

type MyWardrobeToolbarProps = {
  filter: MyWardrobeFilter;
  isMobile: boolean;
  isLoading: boolean;
  onFilterChange: (filter: MyWardrobeFilter) => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenUpload: () => void;
  t: (key: string) => string;
};

const FILTERS: MyWardrobeFilter[] = ["all", "uploaded", "from_catalog"];

function getSourceFilter(filter: MyWardrobeFilter): MyWardrobeSource | null {
  return filter === "all" ? null : filter;
}

function filterKey(filter: MyWardrobeFilter) {
  return filter === "all"
    ? "myWardrobe.filters.all"
    : filter === "uploaded"
      ? "myWardrobe.filters.uploaded"
      : "myWardrobe.filters.fromCatalog";
}

function MyWardrobeMobileToolbar({
  filter,
  isLoading,
  onFilterChange,
  onOpenMenu,
  onOpenUpload,
  t,
}: Omit<MyWardrobeToolbarProps, "isMobile">) {
  return (
    <Stack direction="row" spacing={1} sx={mobileToolbarSx}>
      <FormControl size="small" sx={mobileFilterControlSx}>
        <Select
          value={filter}
          onChange={(event: SelectChangeEvent<MyWardrobeFilter>) => {
            onFilterChange(event.target.value as MyWardrobeFilter);
          }}
          disabled={isLoading}
          displayEmpty
          inputProps={{ "aria-label": t("myWardrobe.filterLabel") }}
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
        <Button
          variant="outlined"
          startIcon={<FileUploadOutlinedIcon />}
          disabled={isLoading}
          aria-label={t("myWardrobe.upload")}
          onClick={onOpenUpload}
          sx={mobileUploadButtonSx}
        >
          {t("myWardrobe.uploadDialog.upload")}
        </Button>
        <IconButton
          aria-label={t("myWardrobe.openMenu")}
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

function MyWardrobeDesktopToolbar({
  filter,
  isLoading,
  onFilterChange,
  onOpenMenu,
  onOpenUpload,
  t,
}: Omit<MyWardrobeToolbarProps, "isMobile">) {
  return (
    <Stack direction="row" spacing={1.5} sx={desktopToolbarSx}>
      <ToggleButtonGroup
        exclusive
        value={filter}
        onChange={(_event, value: MyWardrobeFilter | null) => {
          if (value) {
            onFilterChange(value);
          }
        }}
        aria-label={t("myWardrobe.filterLabel")}
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
        <Button
          variant="outlined"
          startIcon={<FileUploadOutlinedIcon />}
          disabled={isLoading}
          aria-label={t("myWardrobe.upload")}
          onClick={onOpenUpload}
        >
          {t("myWardrobe.uploadDialog.upload")}
        </Button>
        <IconButton
          aria-label={t("myWardrobe.openMenu")}
          disabled={isLoading}
          onClick={onOpenMenu}
        >
          <MoreVertRoundedIcon />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function MyWardrobeToolbar(props: MyWardrobeToolbarProps) {
  return props.isMobile ? (
    <MyWardrobeMobileToolbar {...props} />
  ) : (
    <MyWardrobeDesktopToolbar {...props} />
  );
}

const toolbarSurfaceSx = {
  position: "sticky",
  top: 0,
  zIndex: (theme) => theme.zIndex.appBar,
  alignItems: "center",
  bgcolor: "background.default",
  boxShadow: (theme) => `0 0 0 100vmax ${theme.palette.background.default}`,
  clipPath: "inset(0 -100vmax)",
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

const mobileMenuButtonSx = {
  flex: "0 0 auto",
  width: 40,
  height: 40,
} as const;

const mobileUploadButtonSx = {
  flex: "0 1 auto",
  minWidth: 0,
  px: 1.5,
  whiteSpace: "nowrap",
  "& .MuiButton-startIcon": {
    mr: 0.75,
  },
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

export default MyWardrobeToolbar;
export { getSourceFilter };
export type { MyWardrobeFilter };
