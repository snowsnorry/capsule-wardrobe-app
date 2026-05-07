import { Box } from "@mui/material";
import ProfileFiltersSidebar from "../../components/ProfileFiltersSidebar";
import type { MainScreenProps } from "./MainScreenTypes";

type SidebarProps = {
  props: MainScreenProps;
  disabled: boolean;
  isSigningOut: boolean;
};

function MainScreenSidebar({ props, disabled, isSigningOut }: SidebarProps) {
  return (
    <Box
      sx={{
        display: { xs: "none", lg: "block" },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "10px",
        backgroundColor: "background.paper",
        minHeight: 0,
        overflowY: "auto",
        p: 3,
      }}
    >
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
        selectedText={props.selectedText}
        hasFilterChanges={props.hasFilterChanges}
        status={props.status}
        onSelectStyleCore={props.onSelectStyleCore}
        onSelectStyleAesthetic={props.onSelectStyleAesthetic}
        onToggleOccasion={props.onToggleOccasion}
        onToggleSeason={props.onToggleSeason}
        onSelectAudience={props.onSelectAudience}
        onSelectAccentColor={props.onSelectAccentColor}
        onSelectPattern={props.onSelectPattern}
        onTextChange={props.onTextChange}
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
