import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { IoCreateOutline } from "react-icons/io5";
import { SidebarSectionLabel } from "./AppSidebarCapsuleNavigation";
import { getCapsuleChildrenSx } from "./AppSidebarCapsuleNavigationStyles";
import type { AppId } from "./AppSidebarNavigationTypes";

type Translate = (key: string) => string;

const wardrobeActionButtonSx = {
  width: 32,
  height: 32,
  minWidth: 0,
  p: 0.5,
  borderRadius: "var(--cw-radius-card)",
  color: "primary.main",
} as const;

function WardrobePlaceholderActions({ t }: { t: Translate }) {
  const searchOutfitsLabel = t("wardrobe.searchOutfits");
  const newOutfitLabel = t("wardrobe.newOutfit");

  return (
    <Stack
      className="wardrobe-primary-actions"
      direction="row"
      spacing={0.25}
      sx={{ ml: "auto", flexShrink: 0 }}
    >
      <Tooltip title={searchOutfitsLabel} placement="top">
        <span>
          <IconButton
            aria-label={searchOutfitsLabel}
            disabled
            tabIndex={-1}
            size="small"
            sx={wardrobeActionButtonSx}
          >
            <SearchRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={newOutfitLabel} placement="top">
        <span>
          <IconButton
            aria-label={newOutfitLabel}
            disabled
            tabIndex={-1}
            size="small"
            sx={wardrobeActionButtonSx}
          >
            <IoCreateOutline data-testid="IoCreateOutline" size={20} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

function WardrobeChildRow({
  label,
  isActive,
  isInteractionDisabled,
  tabIndex,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isInteractionDisabled: boolean;
  tabIndex: number;
  onClick: () => void;
}) {
  return (
    <ListItemButton
      tabIndex={tabIndex}
      selected={isActive}
      disabled={isInteractionDisabled}
      onClick={onClick}
      sx={{
        borderRadius: "var(--cw-radius-card)",
        mb: 0.25,
        pl: 4.5,
        pr: 1.5,
        minHeight: 36,
        py: 0.5,
      }}
    >
      <ListItemText
        primary={label}
        slotProps={{
          primary: {
            noWrap: true,
            sx: {
              fontSize: "14px",
              fontWeight: isActive ? 700 : 500,
            },
          },
        }}
      />
    </ListItemButton>
  );
}

function WardrobeChildren({
  showWardrobeChildren,
  activeApp,
  isInteractionDisabled,
  onNavigateApp,
  t,
}: {
  showWardrobeChildren: boolean;
  activeApp: AppId;
  isInteractionDisabled: boolean;
  onNavigateApp: (nextApp: AppId) => void;
  t: Translate;
}) {
  const wardrobeChildTabIndex = showWardrobeChildren ? 0 : -1;

  return (
    <Box
      data-testid="wardrobe-sidebar-children"
      aria-hidden={!showWardrobeChildren}
      sx={getCapsuleChildrenSx(showWardrobeChildren)}
    >
      <Stack
        sx={{
          minHeight: 0,
          overflow: "hidden",
          ml: 0,
          mr: 1.5,
          pl: 1.5,
        }}
      >
        <List sx={{ overflow: "hidden", px: 0, pt: 0, pb: 0 }}>
          <WardrobeChildRow
            label={t("wardrobe.allItems")}
            isActive={activeApp === "wardrobe"}
            isInteractionDisabled={isInteractionDisabled}
            tabIndex={wardrobeChildTabIndex}
            onClick={() => onNavigateApp("wardrobe")}
          />
        </List>
        <SidebarSectionLabel
          label={t("wardrobe.yourOutfits")}
          actions={<WardrobePlaceholderActions t={t} />}
        />
      </Stack>
    </Box>
  );
}

export { WardrobeChildren };
