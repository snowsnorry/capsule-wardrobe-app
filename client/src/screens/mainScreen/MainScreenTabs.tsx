import { Box, Tab, Tabs } from "@mui/material";
import { useI18n } from "../../i18n/useI18n";
import type { ResolvedOutfitSet } from "./MainScreenTypes";

function MainScreenTabs({
  activeTab,
  disabled,
  sets,
  onChange,
}: {
  activeTab: string;
  disabled: boolean;
  isOverlay: boolean;
  selectedCount: number;
  sets: ResolvedOutfitSet[];
  summary: string[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      {sets.length > 0 ? (
        <Box>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => {
              if (!disabled) onChange(value);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: { xs: 2, md: 3 },
              "& .MuiTab-root": { textTransform: "none" },
            }}
          >
            <Tab value="all" label={t("search.all")} disabled={disabled} />
            {sets.map((set) => (
              <Tab
                key={set.id}
                value={set.id}
                label={t("capsule.outfitSet", { number: set.label })}
                disabled={disabled}
              />
            ))}
          </Tabs>
        </Box>
      ) : null}
    </>
  );
}

export default MainScreenTabs;
