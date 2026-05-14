import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import useMediaQuery from "@mui/material/useMediaQuery";
import { fetchMyWardrobeItems, type MyWardrobeSource } from "../api/myWardrobe";
import ClothingCard from "../components/ClothingCard";
import ClothingGridPlaceholder, {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../components/ClothingGridPlaceholder";
import { useI18n } from "../i18n/useI18n";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./mainScreen/MainScreenHelpers";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type MyWardrobeFilter = "all" | MyWardrobeSource;

type MyWardrobeItemsResponse = {
  items?: MainScreenItem[];
};

const FILTERS: MyWardrobeFilter[] = ["all", "uploaded", "from_catalog"];

function getSourceFilter(filter: MyWardrobeFilter): MyWardrobeSource | null {
  return filter === "all" ? null : filter;
}

function getItemsFromResponse(response: unknown): MainScreenItem[] {
  const items = (response as MyWardrobeItemsResponse)?.items;
  return Array.isArray(items) ? items : [];
}

function MyWardrobeScreen(): ReactElement {
  const { t } = useI18n();
  const isOverlay = useMediaQuery("(max-width: 1279.95px)");
  const [filter, setFilter] = useState<MyWardrobeFilter>("all");
  const [items, setItems] = useState<MainScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const mobileColumns = isOverlay ? 2 : 2;
  const source = useMemo(() => getSourceFilter(filter), [filter]);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    fetchMyWardrobeItems({ source })
      .then((response) => {
        if (!isActive) {
          return;
        }
        setItems(getItemsFromResponse(response));
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setItems([]);
        setError(t("myWardrobe.loadFailed"));
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [source, t]);

  return (
    <Box sx={myWardrobeScreenSx}>
      <Stack spacing={2.25} sx={myWardrobeContentSx}>
        <MyWardrobeToolbar
          filter={filter}
          isLoading={isLoading}
          t={t}
          onFilterChange={setFilter}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        <MyWardrobeGrid
          isLoading={isLoading}
          isOverlay={isOverlay}
          items={items}
          mobileColumns={mobileColumns}
          t={t}
        />
      </Stack>
    </Box>
  );
}

function MyWardrobeToolbar({
  filter,
  isLoading,
  onFilterChange,
  t,
}: {
  filter: MyWardrobeFilter;
  isLoading: boolean;
  onFilterChange: (filter: MyWardrobeFilter) => void;
  t: (key: string) => string;
}) {
  return (
    <Stack spacing={1.5} sx={toolbarSx}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("myWardrobe.title")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<FileUploadOutlinedIcon />}
          disabled={isLoading}
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          {t("myWardrobe.upload")}
        </Button>
      </Stack>
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
            aria-label={t(filterKey(value))}
          >
            {t(filterKey(value))}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}

function filterKey(filter: MyWardrobeFilter) {
  return filter === "all"
    ? "myWardrobe.filters.all"
    : filter === "uploaded"
      ? "myWardrobe.filters.uploaded"
      : "myWardrobe.filters.fromCatalog";
}

function MyWardrobeGrid({
  isLoading,
  isOverlay,
  items,
  mobileColumns,
  t,
}: {
  isLoading: boolean;
  isOverlay: boolean;
  items: MainScreenItem[];
  mobileColumns: 1 | 2 | 3;
  t: (key: string) => string;
}) {
  if (isLoading) {
    return <ClothingGridPlaceholder count={12} mobileColumns={mobileColumns} />;
  }

  if (items.length === 0) {
    return (
      <Stack spacing={0.75} sx={emptyStateSx}>
        <Typography variant="h6">{t("myWardrobe.emptyTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("myWardrobe.emptyBody")}
        </Typography>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: buildClothingGridTemplateColumns(mobileColumns),
        gap: buildClothingGridGap(mobileColumns),
        "@media (min-width: 1400px)": {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        },
        "@media (min-width: 1760px)": {
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      {items.map((item) => (
        <ClothingCard
          key={item.id || item.url}
          item={item}
          isMobile={isOverlay}
          mobileColumns={mobileColumns}
          showProductMenu={false}
        />
      ))}
    </Box>
  );
}

const myWardrobeScreenSx = {
  height: "100%",
  minHeight: 0,
  overflowY: "auto",
  overscrollBehaviorY: "contain",
  WebkitOverflowScrolling: "touch",
  pt: { xs: 1.5, md: 2 },
  pb: 2,
} as const;

const myWardrobeContentSx = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  px: { xs: 2, md: 3 },
  minHeight: "100%",
} as const;

const toolbarSx = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  py: 1.5,
  bgcolor: "background.default",
} as const;

const filterGroupSx = {
  alignSelf: "flex-start",
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

const emptyStateSx = {
  maxWidth: 520,
  pt: { xs: 3, md: 4 },
} as const;

export default MyWardrobeScreen;
