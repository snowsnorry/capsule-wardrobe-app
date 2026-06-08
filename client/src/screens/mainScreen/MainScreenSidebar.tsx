import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import ProfileFiltersSidebar from "../../components/ProfileFiltersSidebar";
import type { MainScreenProps } from "./MainScreenTypes";

type SidebarProps = {
  props: MainScreenProps;
  disabled: boolean;
  isSigningOut: boolean;
};

const sidebarPanelSx = (theme: Theme) => {
  return {
    display: { xs: "none", lg: "block" },
    position: { lg: "sticky" },
    top: { lg: 16 },
    alignSelf: "start",
    minHeight: 0,
    maxHeight: "calc(100vh - 32px)",
    overflowX: "hidden",
    overflowY: "auto",
    p: 3,
    border: "1px solid",
    borderColor: alpha(theme.palette.primary.main, 0.12),
    borderRadius: "var(--cw-radius-panel)",
    backgroundColor: alpha(theme.palette.background.paper, 0.78),
    backdropFilter: "blur(12px) saturate(1.04)",
    WebkitBackdropFilter: "blur(12px) saturate(1.04)",
    boxShadow: "var(--cw-shadow-wardrobe-card)",
    "@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))":
      {
        backgroundColor: alpha(theme.palette.background.paper, 0.94),
      },
  };
};

function MainScreenSidebar({ props, disabled, isSigningOut }: SidebarProps) {
  return (
    <Box sx={sidebarPanelSx}>
      <ProfileFiltersSidebar
        styleOptions={props.styleOptions}
        occasionOptions={props.occasionOptions}
        seasonOptions={props.seasonOptions}
        audienceOptions={props.audienceOptions}
        accentColorOptions={props.accentColorOptions}
        patternOptions={props.patternOptions}
        selectedStyleCore={props.selectedStyleCore}
        selectedStyleAesthetic={props.selectedStyleAesthetic}
        selectedOccasions={props.selectedOccasions}
        selectedSeasons={props.selectedSeasons}
        selectedAudience={props.selectedAudience}
        selectedAccentColor={props.selectedAccentColor}
        selectedPattern={props.selectedPattern}
        selectedSourceMode={props.selectedSourceMode}
        selectedText={props.selectedText}
        selectedAnchorItemRefs={props.selectedAnchorItemRefs}
        selectedAnchorWardrobeItemIds={props.selectedAnchorWardrobeItemIds}
        hasFilterChanges={props.hasFilterChanges}
        status={props.status}
        onSelectStyleCore={props.onSelectStyleCore}
        onSelectStyleAesthetic={props.onSelectStyleAesthetic}
        onToggleOccasion={props.onToggleOccasion}
        onToggleSeason={props.onToggleSeason}
        onSelectAudience={props.onSelectAudience}
        onSelectAccentColor={props.onSelectAccentColor}
        onSelectPattern={props.onSelectPattern}
        onSelectSourceMode={props.onSelectSourceMode}
        onTextChange={props.onTextChange}
        onSelectAnchorItemRefs={props.onSelectAnchorItemRefs}
        onSelectAnchorWardrobeItemIds={props.onSelectAnchorWardrobeItemIds}
        onApply={props.onApplyFilters}
        onReset={props.onResetFilters}
        onSignOut={null}
        isSigningOut={isSigningOut}
        isInteractionDisabled={disabled}
      />
    </Box>
  );
}

export default MainScreenSidebar;
