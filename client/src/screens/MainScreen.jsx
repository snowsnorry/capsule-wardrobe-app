import { useState } from "react";
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
  Stack,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import TuneIcon from "@mui/icons-material/Tune";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ProfileFiltersSidebar from "../components/ProfileFiltersSidebar.jsx";
import { useI18n } from "../i18n/useI18n.js";
import ClothingGridPlaceholder from "../components/ClothingGridPlaceholder.jsx";
import { ClothingPlaceholderCard } from "../components/ClothingGridPlaceholder.jsx";
import ClothingCard from "../components/ClothingCard.jsx";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import AppLauncher from "../components/AppLauncher.jsx";

function MainScreen({
  onSignOut,
  isSigningOut,
  onRefreshItems,
  onDownloadPdf,
  items,
  isLoadingItems,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const selectedCount = selectedRegenerationUrls.length;

  const handleConfirmSignOut = () => {
    setIsSignOutOpen(false);
    onSignOut();
  };

  const handleCancelSignOut = () => {
    setIsSignOutOpen(false);
  };

  const handleApplyMobileFilters = async () => {
    await onApplyFilters();
    setIsFiltersOpen(false);
  };

  const handleCancelMobileFilters = async () => {
    await onResetFilters();
    setIsFiltersOpen(false);
  };

  return (
    <>
      <Stack spacing={0} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            backgroundColor: "background.paper",
            pb: 1
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography
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
            <Stack direction="row" spacing={1.2} alignItems="center">
              <AppLauncher currentApp="capsule" onSelectApp={onNavigateApp} />
              <LocaleSwitcher />
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
            gap: { xs: 3, lg: 4 },
            flex: 1,
            minHeight: 0,
            overflow: "hidden"
          }}
        >
          <Box
            sx={{
              display: { xs: "none", lg: "block" },
              pr: { lg: 4 },
              borderRight: { lg: "1px solid rgba(31, 41, 51, 0.12)" },
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
              onSignOut={() => setIsSignOutOpen(true)}
              isSigningOut={isSigningOut}
            />
          </Box>

          <Stack spacing={2.5} sx={{ minWidth: 0, minHeight: 0, overflowY: "auto", pr: 0.5 }}>
            <Stack direction="row" justifyContent="space-between">
              {isMobile ? (
                <IconButton aria-label={t("filters.open")} onClick={() => setIsFiltersOpen(true)}>
                  <TuneIcon />
                </IconButton>
              ) : (
                <Box />
              )}
              {selectedCount > 0 ? (
                <Stack direction="row" spacing={1} sx={{ minHeight: 40, alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    onClick={onCancelRegenerationSelection}
                    disabled={isPartialRegenerationLoading}
                    sx={{ minHeight: 40 }}
                  >
                    {t("main.cancelSelection")}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={onRegenerateSelectedItems}
                    disabled={isPartialRegenerationLoading}
                    sx={{ minHeight: 40 }}
                  >
                    {t("main.regenerateSelected", { count: selectedCount })}
                  </Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5} sx={{ minHeight: 40, alignItems: "center" }}>
                  <IconButton
                    aria-label={t("main.download")}
                    onClick={onDownloadPdf}
                    disabled={isDownloadingPdf || items.length === 0 || isPartialRegenerationLoading}
                  >
                    <DownloadRoundedIcon />
                  </IconButton>
                  <IconButton
                    aria-label={t("main.refresh")}
                    onClick={onRefreshItems}
                    disabled={isLoadingItems || isPartialRegenerationLoading}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Stack>
              )}
            </Stack>
            <Divider />
            {isLoadingItems ? (
              <ClothingGridPlaceholder count={12} />
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                    xl: "repeat(4, minmax(0, 1fr))"
                  },
                  gap: 2.5
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
                      isMobile={isMobile}
                    />
                  );
                })}
                {showAdditionalItemPlaceholder ? (
                  <ClothingGridPlaceholder count={1} inline />
                ) : null}
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>

      <Dialog open={isSignOutOpen} onClose={handleCancelSignOut}>
        <DialogTitle>{t("dialogs.signOutTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("dialogs.signOutBody")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSignOut} disabled={isSigningOut}>
            {t("dialogs.signOutCancel")}
          </Button>
          <Button
            onClick={handleConfirmSignOut}
            color="error"
            variant="contained"
            disabled={isSigningOut}
          >
            {t("dialogs.signOutConfirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog fullScreen open={isFiltersOpen} onClose={handleCancelMobileFilters}>
        <DialogContent sx={{ px: 0, py: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              backgroundColor: "background.paper",
              px: 3,
              pt: 3,
              pb: 2
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Typography
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
              <LocaleSwitcher />
            </Stack>
            <Divider sx={{ mt: 2 }} />
          </Box>
          <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", px: 3, py: 2 }}>
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
              onApply={handleApplyMobileFilters}
              onReset={handleCancelMobileFilters}
              onSignOut={() => {
                setIsFiltersOpen(false);
                setIsSignOutOpen(true);
              }}
              isSigningOut={isSigningOut}
              resetLabelKey="filters.cancel"
            />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MainScreen;
