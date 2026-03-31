import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ProfileFiltersSidebar from "../components/ProfileFiltersSidebar.jsx";
import { useI18n } from "../i18n/useI18n.js";
import ClothingGridPlaceholder from "../components/ClothingGridPlaceholder.jsx";
import { ClothingPlaceholderCard } from "../components/ClothingGridPlaceholder.jsx";
import ClothingCard from "../components/ClothingCard.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import AppLauncher from "../components/AppLauncher.jsx";

function highlightMatch(name, query) {
  const label = String(name || "");
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return label;
  }

  const lower = label.toLowerCase();
  const index = lower.indexOf(normalizedQuery.toLowerCase());
  if (index === -1) {
    return label;
  }

  return (
    <>
      {label.slice(0, index)}
      <strong>{label.slice(index, index + normalizedQuery.length)}</strong>
      {label.slice(index + normalizedQuery.length)}
    </>
  );
}

function getCapsuleSectionLabel(updatedAt) {
  if (!updatedAt) {
    return "Earlier";
  }
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return "Previous 7 Days";
  }
  if (diffDays < 30) {
    return "Previous 30 Days";
  }
  return "Earlier";
}

function groupCapsules(items = []) {
  return items.reduce((acc, item) => {
    const key = getCapsuleSectionLabel(item.updatedAt);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function capsuleHasUnsavedChanges(capsule) {
  return capsule?.status === "new" || capsule?.status === "modified";
}

function CapsuleActionMenu({
  anchorEl,
  open,
  onClose,
  capsule,
  showRegenerateAll = false,
  onRegenerateAll,
  onDownloadPdf,
  onRename,
  onRevert,
  onSave,
  onDuplicate,
  onDelete
}) {
  const canRevert = capsule?.status === "modified";
  const canSave = capsule?.status === "new" || capsule?.status === "modified";
  const canDuplicate = Boolean(capsule?.saved && capsule?.draft);

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {showRegenerateAll ? (
        <>
          <MenuItem onClick={() => { onClose(); onRegenerateAll?.(); }}>
            <ListItemIcon sx={{ visibility: "hidden" }} />
            Regenerate all
          </MenuItem>
          <Divider />
        </>
      ) : null}
      <MenuItem onClick={() => { onClose(); onDownloadPdf(); }}>
        <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
        Export as PDF
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { onClose(); onRename(); }}>
        <ListItemIcon><DriveFileRenameOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        Rename
      </MenuItem>
      <Divider />
      <MenuItem disabled={!canRevert} onClick={() => { onClose(); onRevert(); }}>
        <ListItemIcon><RestoreRoundedIcon fontSize="small" /></ListItemIcon>
        Revert
      </MenuItem>
      <MenuItem disabled={!canSave} onClick={() => { onClose(); onSave(); }}>
        <ListItemIcon sx={{ visibility: "hidden" }} />
        Save
      </MenuItem>
      {canDuplicate ? (
        <MenuItem onClick={() => { onClose(); onDuplicate(); }}>
          <ListItemIcon sx={{ visibility: "hidden" }} />
          Save as...
        </MenuItem>
      ) : null}
      <Divider />
      <MenuItem onClick={() => { onClose(); onDelete(); }} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        Delete
      </MenuItem>
    </Menu>
  );
}

function MainScreen({
  activeCapsule = null,
  capsuleList = [],
  userEmail = "",
  onSignOut = () => {},
  isSigningOut,
  onRefreshItems,
  onDownloadPdf,
  onCreateCapsule = async () => {},
  onOpenCapsule = async () => {},
  onSaveCapsule = async () => {},
  onRevertCapsule = async () => {},
  onRenameCapsule = async () => {},
  onDuplicateCapsule = async () => {},
  onDeleteCapsule = async () => {},
  onSearchCapsules = async () => [],
  items,
  isLoadingItems,
  isContentBusy = false,
  isDownloadingPdf,
  showAdditionalItemPlaceholder,
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  accentColorOptions,
  patternOptions,
  selectedStyleCore,
  selectedStyleAesthetic,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  selectedAccentColor,
  selectedPattern,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
  onSelectPattern,
  onApplyFilters,
  onResetFilters,
  onNavigateApp,
  selectedRegenerationUrls,
  partialRegenerationPendingUrls,
  onToggleRegenerationSelection,
  onCancelRegenerationSelection,
  onRegenerateSelectedItems,
  isPartialRegenerationLoading
}) {
  const { t } = useI18n();
  useTheme();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const isLargeDesktopSidebar = useMediaQuery("(min-width: 1680px)");
  const isMediumDesktopSidebar = !isOverlaySidebar && !isLargeDesktopSidebar;
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuCapsule, setRowMenuCapsule] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameCapsuleId, setRenameCapsuleId] = useState("");
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsValue, setSaveAsValue] = useState("");
  const [saveAsCapsuleId, setSaveAsCapsuleId] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [confirmCapsuleId, setConfirmCapsuleId] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [optimisticActiveCapsuleId, setOptimisticActiveCapsuleId] = useState(activeCapsule?.id || "");

  const selectedCount = selectedRegenerationUrls.length;
  const searchGroups = useMemo(() => groupCapsules(searchResults), [searchResults]);
  const activeCapsuleName = activeCapsule?.name || "<New capsule>";
  const desktopSidebarWidth = isSidebarCollapsed ? 72 : 296;
  const desktopSidebarRailWidth = 72;
  const desktopSidebarExpandedWidth = 296;
  const desktopSidebarGap = 12;
  const mainBlockOffset = isOverlaySidebar
    ? 0
    : (isLargeDesktopSidebar
        ? desktopSidebarExpandedWidth + desktopSidebarGap
        : desktopSidebarWidth + desktopSidebarGap);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    let isCurrent = true;
    setIsSearching(true);
    onSearchCapsules(searchQuery).then((items) => {
      if (isCurrent) {
        setSearchResults(items);
      }
    }).finally(() => {
      if (isCurrent) {
        setIsSearching(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [searchOpen, searchQuery, onSearchCapsules]);

  useEffect(() => {
    setOptimisticActiveCapsuleId(activeCapsule?.id || "");
  }, [activeCapsule?.id]);

  const handleCapsuleOpen = async (capsuleId) => {
    setOptimisticActiveCapsuleId(capsuleId);
    await onOpenCapsule(capsuleId);
    setIsSidebarOpen(false);
    setSearchOpen(false);
  };

  const handleCreateNewCapsule = async () => {
    await onCreateCapsule();
    setIsSidebarOpen(false);
  };

  const handleRequestDuplicate = async (capsule = activeCapsule) => {
    if (!capsule?.id) {
      return;
    }
    setSaveAsCapsuleId(capsule.id);
    setSaveAsValue(capsule.name || "");
    setSaveAsOpen(true);
  };

  const sidebarContent = (
    <Stack
      sx={{
        height: "100%",
        width: isOverlaySidebar ? "min(92vw, 360px)" : desktopSidebarWidth,
        bgcolor: "#f8f8f7",
        borderRight: "1px solid rgba(15, 23, 42, 0.08)",
        overflow: "hidden",
        transition: isOverlaySidebar ? undefined : "width 240ms ease, box-shadow 240ms ease"
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ minHeight: 64, pt: 2, pb: 1.5 }}
      >
        <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <IconButton
            aria-label="Toggle sidebar"
            onClick={() => (isOverlaySidebar ? setIsSidebarOpen(false) : setIsSidebarCollapsed((value) => !value))}
            sx={{ width: 40, height: 40 }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Box>
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
            pr: 2,
            opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
            transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
            transition: "opacity 180ms ease, transform 220ms ease",
            pointerEvents: isSidebarCollapsed && !isOverlaySidebar ? "none" : "auto"
          }}
        />
      </Stack>

      <Stack spacing={0.5} sx={{ px: 0, alignItems: "stretch" }}>
        <Button
          variant="text"
          onClick={handleCreateNewCapsule}
          sx={{
            justifyContent: "flex-start",
            px: 0,
            minHeight: 44,
            width: "100%",
            minWidth: 0
          }}
        >
          <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <AddRoundedIcon />
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: "1rem",
              fontWeight: 500,
              overflow: "hidden",
              whiteSpace: "nowrap",
              opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
              transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
              transition: "opacity 180ms ease, transform 220ms ease"
            }}
          >
            New capsule
          </Box>
        </Button>
        <Button
          variant="text"
          onClick={() => setSearchOpen(true)}
          sx={{
            justifyContent: "flex-start",
            px: 0,
            minHeight: 44,
            width: "100%",
            minWidth: 0
          }}
        >
          <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <SearchRoundedIcon />
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: "1rem",
              fontWeight: 500,
              overflow: "hidden",
              whiteSpace: "nowrap",
              opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
              transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
              transition: "opacity 180ms ease, transform 220ms ease"
            }}
          >
            Search capsules
          </Box>
        </Button>
      </Stack>

      {!isSidebarCollapsed || isOverlaySidebar ? (
        <Typography
          sx={{
            pl: 3,
            pr: 3,
            pt: 3,
            pb: 1,
            color: "text.secondary",
            fontSize: "0.95rem",
            textAlign: "left"
          }}
        >
          Your capsules
        </Typography>
      ) : null}

      {!isSidebarCollapsed || isOverlaySidebar ? (
        <List sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5 }}>
          {capsuleList.map((capsule) => {
            const isActive = capsule.id === optimisticActiveCapsuleId;
            return (
              <ListItemButton
                key={capsule.id}
                selected={isActive}
                onClick={() => handleCapsuleOpen(capsule.id)}
                sx={{
                  borderRadius: 3,
                  mb: 0.5,
                  px: 1.5,
                  minHeight: 48,
                  "& .capsule-row-actions": {
                    opacity: isOverlaySidebar ? 1 : 0,
                    transition: "opacity 160ms ease"
                  },
                  "&:hover .capsule-row-actions": {
                    opacity: 1
                  },
                  "&:focus-within .capsule-row-actions": {
                    opacity: 1
                  }
                }}
              >
                <ListItemText
                  primary={capsule.name}
                  primaryTypographyProps={{ noWrap: true, fontWeight: isActive ? 600 : 500 }}
                />
                {capsuleHasUnsavedChanges(capsule) ? (
                  <Tooltip title="Not saved">
                    <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", mr: 0.75 }} />
                  </Tooltip>
                ) : null}
                <IconButton
                  className="capsule-row-actions"
                  aria-label={`Capsule actions ${capsule.name}`}
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRowMenuAnchor(event.currentTarget);
                    setRowMenuCapsule(capsule);
                  }}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            );
          })}
        </List>
      ) : (
        <Box sx={{ flex: 1 }} />
      )}

      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Button
          aria-label="Open user menu"
          onClick={(event) => setUserMenuAnchor(event.currentTarget)}
          sx={{
            width: "100%",
            justifyContent: "flex-start",
            px: 0,
            py: 2,
            borderRadius: 0
          }}
        >
          <Box sx={{ width: desktopSidebarRailWidth, display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#9aa4a6" }}>
              SN
            </Avatar>
          </Box>
          {!isSidebarCollapsed || isOverlaySidebar ? (
            <Stack
              justifyContent="center"
              sx={{ minHeight: 36, minWidth: 0 }}
            >
              <Typography
                color="text.primary"
                noWrap
                sx={{
                  opacity: isSidebarCollapsed && !isOverlaySidebar ? 0 : 1,
                  transform: isSidebarCollapsed && !isOverlaySidebar ? "translateX(-8px)" : "translateX(0)",
                  transition: "opacity 180ms ease, transform 220ms ease"
                }}
              >
                {userEmail || ""}
              </Typography>
            </Stack>
          ) : null}
        </Button>
      </Box>
    </Stack>
  );

  return (
    <>
      {isOverlaySidebar ? (
        <Drawer open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}>
          {sidebarContent}
        </Drawer>
      ) : (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 1200
          }}
        >
          {sidebarContent}
        </Box>
      )}

      <Stack
        spacing={0}
        sx={{
          height: "100%",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            ml: isOverlaySidebar ? 0 : `${mainBlockOffset}px`,
            mr: isOverlaySidebar ? 0 : `${desktopSidebarGap}px`,
            my: { xs: 0, md: 0.5 },
            display: "flex",
            justifyContent: isLargeDesktopSidebar ? "center" : "stretch"
          }}
        >
          <Box
            data-testid="main-screen-shell"
            data-sidebar-mode={
              isOverlaySidebar ? "overlay" : (isLargeDesktopSidebar ? "desktop-large" : "desktop-medium")
            }
            sx={{
              width: isLargeDesktopSidebar ? "min(100%, 1600px)" : "100%",
              maxWidth: isLargeDesktopSidebar ? "1600px" : undefined,
              minHeight: 0,
              overflow: "hidden",
              bgcolor: "background.paper",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: { xs: 0, md: "22px" },
              boxShadow: "none",
              px: { xs: 2, md: 3 },
              py: { xs: 1.5, md: 2 },
              display: "flex",
              flexDirection: "column"
            }}
          >
            <Box sx={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "background.paper", pb: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  {isOverlaySidebar ? (
                    <IconButton aria-label="Toggle sidebar" onClick={() => setIsSidebarOpen(true)}>
                      <MenuRoundedIcon />
                    </IconButton>
                  ) : null}
                  {!isOverlaySidebar ? (
                    <Typography
                      noWrap
                      sx={{
                        fontFamily: '"Leckerli One", cursive',
                        fontSize: "1.85rem",
                        lineHeight: 1.1,
                        color: "#8f6f45",
                        textAlign: "left"
                      }}
                    >
                      {t("appName")}
                    </Typography>
                  ) : null}
                </Stack>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <AppLauncher currentApp="capsule" onSelectApp={onNavigateApp} />
                  <LocaleSwitcher />
                </Stack>
              </Stack>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  lg: "320px minmax(0, 1fr)"
                },
                gap: { xs: 3, lg: 3 },
                flex: 1,
                minHeight: 0,
                overflow: "hidden"
              }}
            >
            <Box
              sx={{
                display: { xs: "none", lg: "block" },
                pr: { lg: 3 },
                borderRight: { lg: "1px solid rgba(31, 41, 51, 0.08)" },
                minHeight: 0,
                overflowY: "auto"
              }}
            >
              <ProfileFiltersSidebar
                styleOptions={styleOptions}
                occasionOptions={occasionOptions}
                seasonOptions={seasonOptions}
                audienceOptions={audienceOptions}
                accentColorOptions={accentColorOptions}
                patternOptions={patternOptions}
                selectedStyleCore={selectedStyleCore}
                selectedStyleAesthetic={selectedStyleAesthetic}
                selectedOccasions={selectedOccasions}
                selectedSeasons={selectedSeasons}
                selectedAudience={selectedAudience}
                selectedAccentColor={selectedAccentColor}
                selectedPattern={selectedPattern}
                status={status}
                onSelectStyleCore={onSelectStyleCore}
                onSelectStyleAesthetic={onSelectStyleAesthetic}
                onToggleOccasion={onToggleOccasion}
                onToggleSeason={onToggleSeason}
                onSelectAudience={onSelectAudience}
                onSelectAccentColor={onSelectAccentColor}
                onSelectPattern={onSelectPattern}
                onApply={onApplyFilters}
                onReset={onResetFilters}
                onSignOut={null}
                isSigningOut={isSigningOut}
              />
            </Box>

            <Stack spacing={2.5} sx={{ minWidth: 0, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                  {isOverlaySidebar ? (
                    <IconButton
                      aria-label={t("filters.open")}
                      onClick={() => setIsFiltersOpen(true)}
                      sx={{ ml: -1 }}
                    >
                      <TuneRoundedIcon />
                    </IconButton>
                  ) : null}
                  <Typography
                    variant="h6"
                    noWrap
                    sx={{
                      minWidth: 0
                    }}
                  >
                    {activeCapsuleName}
                  </Typography>
                  {capsuleHasUnsavedChanges(activeCapsule) ? (
                    <Tooltip title="Not saved">
                      <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
                    </Tooltip>
                  ) : null}
                </Stack>
                {selectedCount > 0 ? (
                  <Stack direction="row" spacing={1} sx={{ minHeight: 40, alignItems: "center" }}>
                    <Button variant="outlined" onClick={onCancelRegenerationSelection} disabled={isPartialRegenerationLoading}>
                      {t("main.cancelSelection")}
                    </Button>
                    <Button variant="contained" onClick={onRegenerateSelectedItems} disabled={isPartialRegenerationLoading}>
                      {t("main.regenerateSelected", { count: selectedCount })}
                    </Button>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ minHeight: 40, alignItems: "center" }}>
                    {!isOverlaySidebar ? (
                      <Button
                        variant="contained"
                        onClick={onRefreshItems}
                        disabled={isLoadingItems || isPartialRegenerationLoading}
                      >
                        Regenerate all
                      </Button>
                    ) : null}
                    <IconButton aria-label="Open capsule menu" onClick={(event) => setHeaderMenuAnchor(event.currentTarget)}>
                      <MoreVertRoundedIcon />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
              <Box sx={{ position: "relative" }}>
                <Divider />
                {isContentBusy ? (
                  <LinearProgress
                    color="success"
                    sx={{
                      position: "absolute",
                      inset: "auto 0 -1px 0",
                      height: 2,
                      backgroundColor: "transparent"
                    }}
                  />
                ) : null}
              </Box>
              {isLoadingItems ? (
                <ClothingGridPlaceholder count={12} />
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(2, minmax(0, 1fr))"
                    },
                    gap: 2.5,
                    "@media (min-width: 1400px)": {
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
                    },
                    "@media (min-width: 1760px)": {
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
                    }
                  }}
                >
                  {items.map((item) => {
                    const itemUrl = String(item?.url || "");
                    if (partialRegenerationPendingUrls.includes(itemUrl)) {
                      return (
                        <ClothingPlaceholderCard
                          key={`pending-${item.url || item.id}`}
                          placeholderKey={`pending-${item.url || item.id}`}
                        />
                      );
                    }

                    return (
                      <ClothingCard
                        key={item.url || item.id}
                        item={item}
                        isSelectable={Boolean(itemUrl)}
                        isSelected={selectedRegenerationUrls.includes(itemUrl)}
                        isRegenerating={isPartialRegenerationLoading}
                        onToggleSelected={onToggleRegenerationSelection}
                        isMobile={isOverlaySidebar}
                      />
                    );
                  })}
                  {showAdditionalItemPlaceholder ? <ClothingGridPlaceholder count={1} inline /> : null}
                </Box>
              )}
            </Stack>
          </Box>
          </Box>
        </Box>
      </Stack>

      <CapsuleActionMenu
        anchorEl={headerMenuAnchor}
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
        capsule={activeCapsule}
        showRegenerateAll={isOverlaySidebar && selectedCount === 0}
        onRegenerateAll={onRefreshItems}
        onDownloadPdf={onDownloadPdf}
        onRename={() => {
          setRenameCapsuleId(activeCapsule?.id || "");
          setRenameValue(activeCapsuleName);
          setRenameOpen(true);
        }}
        onRevert={() => setConfirmAction("revert")}
        onSave={onSaveCapsule}
        onDuplicate={() => handleRequestDuplicate(activeCapsule)}
        onDelete={() => setConfirmAction("delete")}
      />

      <CapsuleActionMenu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={() => {
          setRowMenuAnchor(null);
          setRowMenuCapsule(null);
        }}
        capsule={rowMenuCapsule}
        onDownloadPdf={() => onDownloadPdf(rowMenuCapsule?.id)}
        onRename={() => {
          setRenameCapsuleId(rowMenuCapsule?.id || "");
          setRenameValue(rowMenuCapsule?.name || "");
          setRenameOpen(true);
        }}
        onRevert={() => {
          setConfirmCapsuleId(rowMenuCapsule?.id || "");
          setConfirmAction("revert-row");
        }}
        onSave={() => onSaveCapsule(rowMenuCapsule?.id)}
        onDuplicate={() => handleRequestDuplicate(rowMenuCapsule)}
        onDelete={() => {
          setConfirmCapsuleId(rowMenuCapsule?.id || "");
          setConfirmAction("delete-row");
        }}
      />

      <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={() => setUserMenuAnchor(null)}>
        <MenuItem onClick={() => { setUserMenuAnchor(null); onSignOut(); }}>
          <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
          {t("actions.signOut")}
        </MenuItem>
      </Menu>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullScreen={isOverlaySidebar}>
        <DialogTitle>Rename capsule</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>{t("actions.cancel")}</Button>
          <Button
            onClick={async () => {
              await onRenameCapsule(renameValue, renameCapsuleId);
              setRenameOpen(false);
            }}
            disabled={!renameValue.trim()}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveAsOpen} onClose={() => setSaveAsOpen(false)} fullScreen={isOverlaySidebar}>
        <DialogTitle>Save as</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            value={saveAsValue}
            onChange={(event) => setSaveAsValue(event.target.value)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveAsOpen(false)}>{t("actions.cancel")}</Button>
          <Button
            onClick={async () => {
              await onDuplicateCapsule(saveAsValue, saveAsCapsuleId);
              setSaveAsOpen(false);
            }}
            disabled={!saveAsValue.trim()}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => {
          setConfirmAction("");
          setConfirmCapsuleId("");
        }}
        fullScreen={isOverlaySidebar}
      >
        <DialogTitle>{confirmAction.startsWith("delete") ? "Delete capsule" : "Revert changes"}</DialogTitle>
        <DialogActions>
          <Button onClick={() => {
            setConfirmAction("");
            setConfirmCapsuleId("");
          }}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            color={confirmAction.startsWith("delete") ? "error" : "primary"}
            onClick={async () => {
              if (confirmAction === "delete") {
                await onDeleteCapsule();
              }
              if (confirmAction === "delete-row") {
                await onDeleteCapsule(confirmCapsuleId);
                setRowMenuAnchor(null);
                setRowMenuCapsule(null);
              }
              if (confirmAction === "revert") {
                await onRevertCapsule();
              }
              if (confirmAction === "revert-row") {
                await onRevertCapsule(confirmCapsuleId);
                setRowMenuAnchor(null);
                setRowMenuCapsule(null);
              }
              setConfirmCapsuleId("");
              setConfirmAction("");
            }}
          >
            {confirmAction.startsWith("delete") ? "Delete" : "Revert"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullScreen={isOverlaySidebar} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          <Stack spacing={0}>
            <Stack direction="row" alignItems="center" sx={{ px: 2, py: 2 }}>
              <TextField
                autoFocus
                fullWidth
                variant="standard"
                placeholder="Search capsules..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                InputProps={{ disableUnderline: true }}
              />
              <IconButton onClick={() => setSearchOpen(false)}>
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            <Box sx={{ position: "relative" }}>
              <Divider />
              {isSearching ? (
                <LinearProgress
                  color="success"
                  sx={{
                    position: "absolute",
                    inset: "auto 0 -1px 0",
                    height: 2,
                    backgroundColor: "transparent"
                  }}
                />
              ) : null}
            </Box>
            <Box sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
              {Object.entries(searchGroups).map(([label, group]) => (
                <Stack key={label} spacing={1} sx={{ mb: 3 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  {group.map((capsule) => (
                    <ListItemButton
                      key={capsule.id}
                      onClick={() => handleCapsuleOpen(capsule.id)}
                      sx={{
                        borderRadius: 3,
                        px: 1.5,
                        py: 1.25,
                        alignItems: "center",
                        "& .capsule-search-date": {
                          opacity: 0,
                          transition: "opacity 160ms ease"
                        },
                        "&:hover .capsule-search-date, &:focus-visible .capsule-search-date, &:focus-within .capsule-search-date": {
                          opacity: 1
                        }
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2} sx={{ width: "100%", minWidth: 0 }}>
                        <Typography noWrap sx={{ minWidth: 0, flex: 1 }}>
                          {highlightMatch(capsule.name, searchQuery)}
                        </Typography>
                        <Typography
                          className="capsule-search-date"
                          variant="body2"
                          color="text.secondary"
                          sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                        >
                          {new Date(capsule.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </ListItemButton>
                  ))}
                </Stack>
              ))}
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={isFiltersOpen} onClose={() => setIsFiltersOpen(false)} fullScreen={isOverlaySidebar}>
        <DialogTitle sx={{ pr: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography variant="inherit">{t("filters.title")}</Typography>
            <IconButton aria-label="Close filters" onClick={() => setIsFiltersOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <ProfileFiltersSidebar
            styleOptions={styleOptions}
            occasionOptions={occasionOptions}
            seasonOptions={seasonOptions}
            audienceOptions={audienceOptions}
            accentColorOptions={accentColorOptions}
            patternOptions={patternOptions}
            selectedStyleCore={selectedStyleCore}
            selectedStyleAesthetic={selectedStyleAesthetic}
            selectedOccasions={selectedOccasions}
            selectedSeasons={selectedSeasons}
            selectedAudience={selectedAudience}
            selectedAccentColor={selectedAccentColor}
            selectedPattern={selectedPattern}
            status={status}
            onSelectStyleCore={onSelectStyleCore}
            onSelectStyleAesthetic={onSelectStyleAesthetic}
            onToggleOccasion={onToggleOccasion}
            onToggleSeason={onToggleSeason}
            onSelectAudience={onSelectAudience}
            onSelectAccentColor={onSelectAccentColor}
            onSelectPattern={onSelectPattern}
            onApply={async () => {
              await onApplyFilters();
              setIsFiltersOpen(false);
            }}
            onReset={async () => {
              await onResetFilters();
              setIsFiltersOpen(false);
            }}
            onSignOut={null}
            isSigningOut={isSigningOut}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MainScreen;
