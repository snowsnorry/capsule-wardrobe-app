import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactElement } from "react";
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
import {
  fetchMyWardrobeItems,
  removeCatalogItemFromMyWardrobe,
  type MyWardrobeSource,
} from "../api/myWardrobe";
import { useI18n } from "../i18n/useI18n";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./mainScreen/MainScreenHelpers";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";
import MyWardrobeGrid from "./MyWardrobeGrid";
import {
  MyWardrobeProductMenu,
  MyWardrobeRemoveConfirmDialog,
  type MyWardrobeProductMenuState,
} from "./MyWardrobeProductMenu";
import ProductDetailDialog from "../components/productDetail/ProductDetailDialog";

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
  const [productDetailItem, setProductDetailItem] =
    useState<MainScreenItem | null>(null);
  const wardrobeItems = useMyWardrobeItems(filter, t);
  const mobileColumns = isOverlay ? 2 : 2;

  return (
    <Box sx={myWardrobeScreenSx}>
      <Stack spacing={2.25} sx={myWardrobeContentSx}>
        <MyWardrobeToolbar
          filter={filter}
          isLoading={wardrobeItems.isLoading}
          t={t}
          onFilterChange={setFilter}
        />
        {wardrobeItems.error ? (
          <Alert severity="error">{wardrobeItems.error}</Alert>
        ) : null}
        <MyWardrobeGrid
          isLoading={wardrobeItems.isLoading}
          isOverlay={isOverlay}
          items={wardrobeItems.items}
          mobileColumns={mobileColumns}
          t={t}
          onProductClick={setProductDetailItem}
          onProductMenuClick={wardrobeItems.handleProductMenuClick}
        />
        <MyWardrobeProductMenu
          anchor={wardrobeItems.productMenu.anchor}
          item={wardrobeItems.productMenu.item}
          t={t}
          onClose={wardrobeItems.closeProductMenu}
          onRequestRemove={wardrobeItems.setRemoveConfirmItem}
        />
        <MyWardrobeRemoveConfirmDialog
          item={wardrobeItems.removeConfirmItem}
          isLoading={wardrobeItems.isMutating}
          t={t}
          onClose={() => wardrobeItems.setRemoveConfirmItem(null)}
          onConfirm={wardrobeItems.handleConfirmRemove}
        />
        <ProductDetailDialog
          item={productDetailItem}
          open={Boolean(productDetailItem)}
          isMobile={isOverlay}
          onClose={() => setProductDetailItem(null)}
          onRemoveFromMyWardrobe={wardrobeItems.handleConfirmRemove}
        />
      </Stack>
    </Box>
  );
}

function useMyWardrobeItems(
  filter: MyWardrobeFilter,
  t: (key: string) => string,
) {
  const [items, setItems] = useState<MainScreenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [productMenu, setProductMenu] = useState<MyWardrobeProductMenuState>({
    anchor: null,
    url: "",
    item: null,
  });
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<MainScreenItem | null>(null);
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
  const closeProductMenu = () =>
    setProductMenu({ anchor: null, url: "", item: null });
  const handleProductMenuClick = (
    event: MouseEvent<HTMLButtonElement>,
    url: string,
    item: MainScreenItem,
  ) => {
    setProductMenu({ anchor: event.currentTarget, url, item });
  };
  const handleConfirmRemove = async (item: MainScreenItem) => {
    const url = String(item?.url || "").trim();
    if (!url) return;

    setIsMutating(true);
    try {
      await removeCatalogItemFromMyWardrobe(url);
      setError("");
      setItems((current) =>
        current.filter(
          (currentItem) =>
            currentItem !== item &&
            String(currentItem?.url || "").trim() !== url,
        ),
      );
    } catch {
      setError(t("myWardrobe.removeFailed"));
    } finally {
      setIsMutating(false);
    }
  };

  return {
    closeProductMenu,
    error,
    handleConfirmRemove,
    handleProductMenuClick,
    isLoading,
    isMutating,
    items,
    productMenu,
    removeConfirmItem,
    setRemoveConfirmItem,
  };
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

export default MyWardrobeScreen;
