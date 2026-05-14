import type { MouseEvent } from "react";
import {
  Button,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { MyWardrobeSource } from "../api/myWardrobe";

type MyWardrobeFilter = "all" | MyWardrobeSource;

type MyWardrobeToolbarProps = {
  filter: MyWardrobeFilter;
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

function MyWardrobeToolbar({
  filter,
  isLoading,
  onFilterChange,
  onOpenMenu,
  onOpenUpload,
  t,
}: MyWardrobeToolbarProps) {
  return (
    <Stack direction="row" spacing={1.5} sx={toolbarSx}>
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
          onClick={onOpenUpload}
        >
          {t("myWardrobe.upload")}
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

const toolbarSx = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  py: 1.5,
  bgcolor: "background.default",
} as const;

const toolbarActionsSx = {
  alignItems: "center",
  flexShrink: 0,
} as const;

const filterGroupSx = {
  flexShrink: 1,
  maxWidth: "100%",
  overflowX: "auto",
  "& .MuiToggleButton-root": {
    px: 1.5,
    py: 0.65,
    borderRadius: "999px",
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
