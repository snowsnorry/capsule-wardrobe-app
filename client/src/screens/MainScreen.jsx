import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
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
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import useMediaQuery from "@mui/material/useMediaQuery";
import ProfileFiltersSidebar from "../components/ProfileFiltersSidebar.jsx";
import { useI18n } from "../i18n/useI18n.js";
import ClothingGridPlaceholder from "../components/ClothingGridPlaceholder.jsx";
import { ClothingPlaceholderCard } from "../components/ClothingGridPlaceholder.jsx";
import ClothingCard from "../components/ClothingCard.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import AppLauncher from "../components/AppLauncher.jsx";
import AppSidebarShell from "../components/AppSidebarShell.jsx";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";

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
    return "searchEarlier";
  }
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return "searchPrevious7Days";
  }
  if (diffDays < 30) {
    return "searchPrevious30Days";
  }
  return "searchEarlier";
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

function normalizeCapsuleName(name) {
  return String(name || "").trim();
}

function resolveOutfitSets(items = [], outfitSets = []) {
  const itemsById = new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id)
  );

  return (Array.isArray(outfitSets) ? outfitSets : [])
    .map((set, index) => {
      const resolvedItems = sortWardrobeItems((Array.isArray(set?.itemIds) ? set.itemIds : [])
        .map((id) => itemsById.get(String(id || "").trim()))
        .filter(Boolean));
      return resolvedItems.length >= 3
        ? {
          id: `set-${index + 1}`,
          index,
          label: index + 1,
          items: resolvedItems,
          image: typeof set?.image === "string" && set.image.trim().length > 0
            ? set.image.trim()
            : null
        }
        : null;
    })
    .filter(Boolean);
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
  const { t } = useI18n();
  const canRevert = capsule?.status === "modified";
  const canSave = capsule?.status === "new" || capsule?.status === "modified";
  const canDuplicate = Boolean(capsule?.saved);

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {showRegenerateAll ? (
        <>
          <MenuItem onClick={() => { onClose(); onRegenerateAll?.(); }}>
            <ListItemIcon sx={{ visibility: "hidden" }} />
            {t("capsule.regenerateAll")}
          </MenuItem>
          <Divider />
        </>
      ) : null}
      <MenuItem onClick={() => { onClose(); onDownloadPdf(); }}>
        <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.exportPdf")}
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => { onClose(); onRename(); }}>
        <ListItemIcon><DriveFileRenameOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.rename")}
      </MenuItem>
      <Divider />
      <MenuItem disabled={!canRevert} onClick={() => { onClose(); onRevert(); }}>
        <ListItemIcon><RestoreRoundedIcon fontSize="small" /></ListItemIcon>
        {t("capsule.revert")}
      </MenuItem>
      <MenuItem disabled={!canSave} onClick={() => { onClose(); onSave(); }}>
        <ListItemIcon sx={{ visibility: "hidden" }} />
        {t("actions.save")}
      </MenuItem>
      {canDuplicate ? (
        <MenuItem onClick={() => { onClose(); onDuplicate(); }}>
          <ListItemIcon sx={{ visibility: "hidden" }} />
          {t("capsule.saveAs")}
        </MenuItem>
      ) : null}
      <Divider />
      <MenuItem onClick={() => { onClose(); onDelete(); }} sx={{ color: "error.main" }}>
        <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
        {t("actions.delete")}
      </MenuItem>
    </Menu>
  );
}

function MainScreen({
  activeCapsule = null,
  capsuleList = [],
  userEmail = "",
  userName = "",
  settingsProfile = null,
  onSignOut = () => {},
  onSaveSettings = async () => {},
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
  outfitSets = [],
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
  selectedText,
  hasFilterChanges,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
  onSelectPattern,
  onTextChange,
  onApplyFilters,
  onResetFilters,
  onNavigateApp,
  selectedRegenerationUrls,
  partialRegenerationPendingUrls,
  pendingImageSetIndexes = [],
  onToggleRegenerationSelection,
  onCancelRegenerationSelection,
  onRegenerateSelectedItems,
  onGenerateOutfitSetImage = () => {},
  isPartialRegenerationLoading
}) {
  const { t } = useI18n();
  const isOverlaySidebar = useMediaQuery("(max-width: 1279.95px)");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuCapsule, setRowMenuCapsule] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameCapsuleId, setRenameCapsuleId] = useState("");
  const [isInlineRenameActive, setIsInlineRenameActive] = useState(false);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [isInlineRenameSubmitting, setIsInlineRenameSubmitting] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsValue, setSaveAsValue] = useState("");
  const [saveAsCapsuleId, setSaveAsCapsuleId] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [confirmCapsuleId, setConfirmCapsuleId] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeItemsTab, setActiveItemsTab] = useState("all");
  const [optimisticActiveCapsuleId, setOptimisticActiveCapsuleId] = useState(activeCapsule?.id || "");
  const inlineRenameSubmitGuardRef = useRef(false);
  const searchDialogPaperRef = useRef(null);
  const isDeleteConfirm = confirmAction.startsWith("delete");
  const confirmBodyKey = isDeleteConfirm ? "capsule.deleteConfirmBody" : "capsule.revertConfirmBody";
  const confirmTitleKey = isDeleteConfirm ? "capsule.deleteTitle" : "capsule.revertTitle";
  const confirmButtonKey = isDeleteConfirm ? "capsule.deleteConfirm" : "capsule.revertConfirm";

  const selectedCount = selectedRegenerationUrls.length;
  const searchGroups = useMemo(() => groupCapsules(searchResults), [searchResults]);
  const activeCapsuleName = activeCapsule?.name || `<${t("capsule.new")}>`;
  const resolvedOutfitSets = useMemo(() => resolveOutfitSets(items, outfitSets), [items, outfitSets]);
  const activeOutfitSet = activeItemsTab === "all"
    ? null
    : (resolvedOutfitSets.find((set) => set.id === activeItemsTab) || null);
  const visibleItems = activeItemsTab === "all"
    ? items
    : (activeOutfitSet?.items || items);
  const isActiveOutfitSetImagePending = activeOutfitSet
    ? pendingImageSetIndexes.includes(activeOutfitSet.index)
    : false;
  const activeOutfitSetImageSrc = activeOutfitSet?.image
    ? `data:image/png;base64,${activeOutfitSet.image}`
    : "";

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

  useEffect(() => {
    if (activeItemsTab === "all") {
      return;
    }

    if (!resolvedOutfitSets.some((set) => set.id === activeItemsTab)) {
      setActiveItemsTab("all");
    }
  }, [activeItemsTab, resolvedOutfitSets]);

  useEffect(() => {
    setIsInlineRenameActive(false);
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameSubmitting(false);
    inlineRenameSubmitGuardRef.current = false;
  }, [activeCapsule?.id, activeCapsule?.name]);

  const handleCapsuleOpen = async (capsuleId, onComplete) => {
    setOptimisticActiveCapsuleId(capsuleId);
    await onOpenCapsule(capsuleId);
    onComplete?.();
    setSearchOpen(false);
  };

  const handleCloseSearchDialog = () => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      searchDialogPaperRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
    setSearchOpen(false);
  };

  const handleOpenSearchDialog = (event) => {
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.blur();
    }
    setSearchOpen(true);
  };

  const handleRequestDuplicate = async (capsule = activeCapsule) => {
    if (!capsule?.id) {
      return;
    }
    setSaveAsCapsuleId(capsule.id);
    setSaveAsValue(capsule.name || "");
    setSaveAsOpen(true);
  };

  const handleStartInlineRename = () => {
    if (isOverlaySidebar || !activeCapsule?.id || isInlineRenameSubmitting) {
      return;
    }
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameActive(true);
  };

  const handleCancelInlineRename = () => {
    inlineRenameSubmitGuardRef.current = false;
    setInlineRenameValue(activeCapsule?.name || "");
    setIsInlineRenameActive(false);
    setIsInlineRenameSubmitting(false);
  };

  const handleSubmitInlineRename = async () => {
    if (!activeCapsule?.id || inlineRenameSubmitGuardRef.current || isInlineRenameSubmitting) {
      return;
    }

    const nextName = normalizeCapsuleName(inlineRenameValue);
    const currentName = normalizeCapsuleName(activeCapsule?.name);

    if (!nextName || nextName === currentName) {
      handleCancelInlineRename();
      return;
    }

    inlineRenameSubmitGuardRef.current = true;
    setIsInlineRenameSubmitting(true);
    try {
      await onRenameCapsule(nextName, activeCapsule.id);
      setIsInlineRenameActive(false);
    } finally {
      inlineRenameSubmitGuardRef.current = false;
      setIsInlineRenameSubmitting(false);
    }
  };

  return (
    <>
      <AppSidebarShell
        shellTestId="main-screen-shell"
        currentApp="capsule"
        userEmail={userEmail}
        userName={userName}
        settingsProfile={settingsProfile}
        onSaveSettings={onSaveSettings}
        onSignOut={onSignOut}
        headerContent={({ isOverlaySidebar, openSidebar }) => (
          <Box sx={{ position: "sticky", top: 0, zIndex: 2, backgroundColor: "background.paper", pb: 1.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1.25}>
                {isOverlaySidebar ? (
                  <IconButton aria-label="Toggle sidebar" onClick={openSidebar}>
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
        )}
        sidebarBodyContent={({ isOverlaySidebar, isSidebarCollapsed, desktopSidebarRailWidth, expandCollapsedSidebar, closeSidebar }) => (
          <>
            <Stack spacing={0.5} sx={{ px: 0, alignItems: "stretch" }}>
              <Button
                variant="text"
                onClick={async () => {
                  await onCreateCapsule();
                  if (isOverlaySidebar) {
                    closeSidebar();
                  }
                }}
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
                  {t("capsule.new")}
                </Box>
              </Button>
              <Button
                variant="text"
                onClick={handleOpenSearchDialog}
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
                  {t("capsule.search")}
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
                {t("capsule.yourCapsules")}
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
                      onClick={() => handleCapsuleOpen(capsule.id, closeSidebar)}
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
                        <Tooltip title={t("capsule.notSaved")}>
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
              <Box
                data-testid="collapsed-sidebar-expand-hitbox"
                onClick={expandCollapsedSidebar}
                sx={{ flex: 1, height: "100%", cursor: "pointer" }}
              />
            )}
          </>
        )}
      >
        {({ isOverlaySidebar }) => {
          const nameDialogProps = isOverlaySidebar ? { fullScreen: true } : {
            fullWidth: true,
            maxWidth: "sm",
            PaperProps: {
              sx: {
                width: "min(92vw, 720px)"
              }
            }
          };
          const confirmDialogProps = isOverlaySidebar ? { fullScreen: true } : {
            fullWidth: true,
            maxWidth: "xs",
            PaperProps: {
              sx: {
                width: "min(92vw, 460px)"
              }
            }
          };

          return (
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
                  borderRight: { lg: "1px solid" },
                  borderColor: { lg: "divider" },
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
                  selectedText={selectedText}
                  hasFilterChanges={hasFilterChanges}
                  status={status}
                  onSelectStyleCore={onSelectStyleCore}
                  onSelectStyleAesthetic={onSelectStyleAesthetic}
                  onToggleOccasion={onToggleOccasion}
                  onToggleSeason={onToggleSeason}
                  onSelectAudience={onSelectAudience}
                  onSelectAccentColor={onSelectAccentColor}
                  onSelectPattern={onSelectPattern}
                  onTextChange={onTextChange}
                  onApply={onApplyFilters}
                  onReset={onResetFilters}
                  onSignOut={null}
                  isSigningOut={isSigningOut}
                />
              </Box>

              <Stack
                spacing={resolvedOutfitSets.length > 0 ? 0 : 2.5}
                sx={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                  sx={{ pb: 2.5 }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    {isOverlaySidebar && selectedCount === 0 ? (
                      <IconButton
                        aria-label={t("filters.open")}
                        onClick={() => setIsFiltersOpen(true)}
                        sx={{ ml: -1 }}
                      >
                        <TuneRoundedIcon />
                      </IconButton>
                    ) : null}
                    {!(isOverlaySidebar && selectedCount > 0) ? (
                      <>
                        {isOverlaySidebar ? (
                          <>
                            <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
                              {activeCapsuleName}
                            </Typography>
                            {capsuleHasUnsavedChanges(activeCapsule) ? (
                              <Tooltip title={t("capsule.notSaved")}>
                                <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
                              </Tooltip>
                            ) : null}
                          </>
                        ) : (
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.75}
                            sx={{
                              minWidth: 0,
                              flex: 1,
                              "& .capsule-header-rename-icon": {
                                opacity: isInlineRenameActive ? 1 : 0,
                                transition: "opacity 160ms ease"
                              },
                              "&:hover .capsule-header-rename-icon": {
                                opacity: 1
                              },
                              "&:focus-within .capsule-header-rename-icon": {
                                opacity: 1
                              }
                            }}
                          >
                            {isInlineRenameActive ? (
                              <TextField
                                autoFocus
                                variant="standard"
                                value={inlineRenameValue}
                                disabled={isInlineRenameSubmitting}
                                inputProps={{ "aria-label": "Capsule name" }}
                                onChange={(event) => setInlineRenameValue(event.target.value)}
                                onBlur={() => {
                                  void handleSubmitInlineRename();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleSubmitInlineRename();
                                    return;
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleCancelInlineRename();
                                  }
                                }}
                                sx={{
                                  minWidth: 0,
                                  flex: 1,
                                  mt: "-1px",
                                  "& .MuiInputBase-root": {
                                    alignItems: "center",
                                    fontSize: "1.25rem",
                                    fontWeight: 500,
                                    lineHeight: 1.6,
                                    p: 0,
                                    "&::before": {
                                      display: "none"
                                    },
                                    "&::after": {
                                      display: "none"
                                    }
                                  },
                                  "& .MuiInputBase-root.Mui-focused": {
                                    boxShadow: "inset 0 -1px 0 rgba(15, 23, 42, 0.38)"
                                  },
                                  "& .MuiInputBase-input": {
                                    p: 0,
                                    lineHeight: 1.6
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <Box
                                  component="button"
                                  type="button"
                                  onClick={handleStartInlineRename}
                                  aria-label={`Rename capsule ${activeCapsuleName}`}
                                  sx={{
                                    minWidth: 0,
                                    flexShrink: 1,
                                    p: 0,
                                    border: 0,
                                    background: "transparent",
                                    textAlign: "left",
                                    color: "inherit",
                                    cursor: "text"
                                  }}
                                >
                                  <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
                                    {activeCapsuleName}
                                  </Typography>
                                </Box>
                                {capsuleHasUnsavedChanges(activeCapsule) ? (
                                  <Tooltip title={t("capsule.notSaved")}>
                                    <FiberManualRecordRoundedIcon sx={{ fontSize: 10, color: "#2f8f58", flexShrink: 0 }} />
                                  </Tooltip>
                                ) : null}
                                <Box sx={{ width: 32, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                                  <IconButton
                                    className="capsule-header-rename-icon"
                                    aria-label="Edit capsule name"
                                    size="small"
                                    onClick={handleStartInlineRename}
                                  >
                                    <DriveFileRenameOutlineRoundedIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </>
                            )}
                          </Stack>
                        )}
                      </>
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
                          {t("capsule.regenerateAll")}
                        </Button>
                      ) : null}
                      <IconButton aria-label={t("capsule.openMenu")} onClick={(event) => setHeaderMenuAnchor(event.currentTarget)}>
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
                {resolvedOutfitSets.length > 0 ? (
                  <Tabs
                    value={activeItemsTab}
                    onChange={(_event, value) => setActiveItemsTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 0.5 }}
                  >
                    <Tab value="all" label={t("search.all")} />
                    {resolvedOutfitSets.map((set) => (
                      <Tab
                        key={set.id}
                        value={set.id}
                        label={t("capsule.outfitSet", { number: set.label })}
                      />
                    ))}
                  </Tabs>
                ) : null}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                  {isLoadingItems ? (
                    <ClothingGridPlaceholder count={12} />
                  ) : (
                    <Stack spacing={3} sx={{ minHeight: "100%" }}>
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
                        {visibleItems.map((item) => {
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

                      {activeOutfitSet ? (
                        <Stack spacing={2} sx={{ pb: 2, px: { xs: 0.5, md: 1 } }}>
                          <Divider sx={{ mx: { xs: 1, md: 2 } }} />
                          {isActiveOutfitSetImagePending ? (
                            <Box
                              sx={{
                                alignSelf: "center",
                                width: "100%",
                                borderRadius: 0.3,
                                overflow: "hidden",
                                border: "1px solid",
                                borderColor: "divider",
                                backgroundColor: "grey.100"
                              }}
                            >
                              <Box
                                data-testid="outfit-set-image-placeholder"
                                sx={{
                                  aspectRatio: "5 / 3",
                                  minHeight: 220,
                                  background: "linear-gradient(135deg, rgba(209,15,15,0.05), rgba(255,255,255,0.85))"
                                }}
                              />
                            </Box>
                          ) : activeOutfitSetImageSrc ? (
                            <Box
                              component="img"
                              src={activeOutfitSetImageSrc}
                              alt={`Outfit set ${activeOutfitSet.label}`}
                              data-testid="outfit-set-image"
                              sx={{
                                alignSelf: "center",
                                width: "auto",
                                maxWidth: "100%",
                                height: "auto",
                                borderRadius: 0.3,
                                display: "block",
                                border: "1px solid",
                                borderColor: "divider"
                              }}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              onClick={() => onGenerateOutfitSetImage(activeOutfitSet.index)}
                              sx={{ alignSelf: "center", minWidth: 180 }}
                            >
                              Create image
                            </Button>
                          )}
                        </Stack>
                      ) : null}
                    </Stack>
                  )}
                </Box>
              </Stack>

              <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} {...nameDialogProps}>
                <DialogTitle>{t("capsule.renameTitle")}</DialogTitle>
                <DialogContent sx={{ pt: 1, pb: 0.5 }}>
                  <TextField
                    fullWidth
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    margin="normal"
                  />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                  <Button onClick={() => setRenameOpen(false)}>{t("actions.cancel")}</Button>
                  <Button
                    onClick={async () => {
                      await onRenameCapsule(renameValue, renameCapsuleId);
                      setRenameOpen(false);
                    }}
                    disabled={!renameValue.trim()}
                  >
                    {t("actions.ok")}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog open={saveAsOpen} onClose={() => setSaveAsOpen(false)} {...nameDialogProps}>
                <DialogTitle>{t("capsule.saveAsTitle")}</DialogTitle>
                <DialogContent sx={{ pt: 1, pb: 0.5 }}>
                  <TextField
                    fullWidth
                    autoFocus
                    value={saveAsValue}
                    onChange={(event) => setSaveAsValue(event.target.value)}
                    margin="normal"
                  />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                  <Button onClick={() => setSaveAsOpen(false)}>{t("actions.cancel")}</Button>
                  <Button
                    onClick={async () => {
                      await onDuplicateCapsule(saveAsValue, saveAsCapsuleId);
                      setSaveAsOpen(false);
                    }}
                    disabled={!saveAsValue.trim()}
                  >
                    {t("actions.ok")}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={Boolean(confirmAction)}
                onClose={() => {
                  setConfirmAction("");
                  setConfirmCapsuleId("");
                }}
                {...confirmDialogProps}
              >
                <DialogTitle sx={{ pb: 1 }}>
                  {t(confirmTitleKey)}
                </DialogTitle>
                <DialogContent sx={{ pt: 0.5, pb: 0 }}>
                  <DialogContentText sx={{ color: "text.secondary" }}>
                    {t(confirmBodyKey)}
                  </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
                  <Button onClick={() => {
                    setConfirmAction("");
                    setConfirmCapsuleId("");
                  }}
                  >
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    color={isDeleteConfirm ? "error" : "primary"}
                    variant="contained"
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
                    {t(confirmButtonKey)}
                  </Button>
                </DialogActions>
              </Dialog>

              <Dialog
                open={searchOpen}
                onClose={handleCloseSearchDialog}
                fullScreen={isOverlaySidebar}
                maxWidth="md"
                fullWidth
                PaperProps={{ ref: searchDialogPaperRef }}
              >
                <DialogContent sx={{ p: 0 }}>
                  <Stack spacing={0}>
                    <Stack direction="row" alignItems="center" sx={{ px: 2, py: 2 }}>
                      <TextField
                        autoFocus
                        fullWidth
                        variant="standard"
                        placeholder={t("capsule.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        InputProps={{ disableUnderline: true }}
                      />
                      <IconButton onClick={handleCloseSearchDialog}>
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
                          <Typography color="text.secondary">{t(`capsule.${label}`)}</Typography>
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
                    <IconButton aria-label={t("capsule.closeFilters")} onClick={() => setIsFiltersOpen(false)}>
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
                    selectedText={selectedText}
                    hasFilterChanges={hasFilterChanges}
                    status={status}
                    onSelectStyleCore={onSelectStyleCore}
                    onSelectStyleAesthetic={onSelectStyleAesthetic}
                    onToggleOccasion={onToggleOccasion}
                    onToggleSeason={onToggleSeason}
                    onSelectAudience={onSelectAudience}
                    onSelectAccentColor={onSelectAccentColor}
                    onSelectPattern={onSelectPattern}
                    onTextChange={onTextChange}
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
            </Box>
          );
        }}
      </AppSidebarShell>

      <CapsuleActionMenu
        anchorEl={headerMenuAnchor}
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
        capsule={activeCapsule}
        showRegenerateAll={isOverlaySidebar && selectedCount === 0}
        onRegenerateAll={onRefreshItems}
        onDownloadPdf={onDownloadPdf}
        onRename={() => {
          if (isOverlaySidebar) {
            setRenameCapsuleId(activeCapsule?.id || "");
            setRenameValue(activeCapsuleName);
            setRenameOpen(true);
            return;
          }
          handleStartInlineRename();
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
    </>
  );
}

export default MainScreen;
