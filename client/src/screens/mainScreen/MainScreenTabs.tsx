import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useI18n } from "../../i18n/useI18n";
import type { ResolvedOutfitSet } from "./MainScreenTypes";

function MobileSummary({ items }: { items: string[] }) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={{ color: "text.secondary", minWidth: 0, px: 2, pb: 1.5 }}>
      {items.map((item, index) => (
        <Typography
          key={`${item}-${index}`}
          variant="body2"
          component="span"
          sx={{
            display: "inline-flex",
            gap: 0.75,
            "&::before": index === 0 ? undefined : { content: '"•"', color: "text.disabled" }
          }}
        >
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function MainScreenTabs({
  activeTab,
  disabled,
  isOverlay,
  selectedCount,
  sets,
  summary,
  onChange
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
      {isOverlay && selectedCount === 0 ? <MobileSummary items={summary} /> : null}
      {sets.length > 0 ? (
        <Box>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => {
              if (!disabled) onChange(value);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: { xs: 2, md: 3 }, "& .MuiTab-root": { textTransform: "none" } }}
          >
            <Tab value="all" label={t("search.all")} disabled={disabled} />
            {sets.map((set) => (
              <Tab key={set.id} value={set.id} label={t("capsule.outfitSet", { number: set.label })} disabled={disabled} />
            ))}
          </Tabs>
        </Box>
      ) : null}
    </>
  );
}

export default MainScreenTabs;
